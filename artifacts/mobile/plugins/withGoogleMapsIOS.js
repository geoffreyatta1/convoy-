// Custom Expo config plugin to wire react-native-maps@1.18.0 Google Maps
// renderer into the iOS native build.
//
// react-native-maps@1.18.0 does not ship its own Expo config plugin, so
// autolinking only links the Apple Maps (default) variant. The Google Maps
// renderer (AirGoogleMaps) lives in a separate CocoaPods subspec and requires:
//
//   1. Podfile  — pull the 'MapsGoogle' subspec instead of the bare package,
//                 and add the GoogleMaps + Google-Maps-iOS-Utils pods.
//   2. AppDelegate — call [GMSServices provideAPIKey:] (ObjC) or
//                 GMSServices.provideAPIKey(...) (Swift) before the app boots.
//
// ── Deliberately avoids use_frameworks! :linkage => :static ─────────────────
// Adding use_frameworks! :linkage => :static to the Podfile would fix the
// modular-headers requirement for GoogleMaps but causes three known regressions:
//   • Hermes: bitcode/xcframework conflict under static linking
//   • react-native-agora: C++ ABI mismatch with static frameworks
//   • react-native-reanimated: worklet runtime crash at launch
// Instead we apply :modular_headers => true per-pod (GoogleMaps and
// Google-Maps-iOS-Utils only), which is sufficient and safe.
// ────────────────────────────────────────────────────────────────────────────

const { withDangerousMod, withAppDelegate } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Resolves the Google Maps API key. Priority order:
 *   1. config.ios.config.googleMapsApiKey (set in app.json / app.config.js)
 *   2. GOOGLE_API_KEY env var (EAS secret / Replit secret)
 *   3. EXPO_PUBLIC_GOOGLE_MAPS_API_KEY env var (dev workflow injection)
 *
 * @param {object} config
 * @returns {string}
 */
function resolveApiKey(config) {
  const fromConfig = config?.ios?.config?.googleMapsApiKey;
  if (fromConfig && !fromConfig.startsWith("$(")) return fromConfig;

  return (
    process.env.GOOGLE_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  );
}

/**
 * 1. Podfile modification
 *
 * Expo prebuild auto-links react-native-maps without a subspec, which omits
 * AirGoogleMaps entirely. This modifier:
 *   a) Strips the bare autolinking entry (if present).
 *   b) Injects the MapsGoogle subspec + GoogleMaps/Google-Maps-iOS-Utils pods
 *      inside the main target block (after `use_expo_modules!`) so CocoaPods
 *      sees them as part of the correct target.
 */
function withGoogleMapsPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withGoogleMapsIOS] Podfile not found — skipping Podfile modification.");
        return cfg;
      }

      let podfile = fs.readFileSync(podfilePath, "utf8");

      // Idempotency guard
      if (podfile.includes("MapsGoogle")) return cfg;

      // a) Remove the bare autolinking entry so CocoaPods doesn't pull in the
      //    default (Apple Maps-only) subspec alongside our Google Maps one.
      //    Autolinking typically writes one of these two patterns:
      //      pod 'react-native-maps', :path => '../node_modules/react-native-maps'
      //      pod 'RNMaps', :path => '../node_modules/react-native-maps'
      podfile = podfile.replace(
        /^\s*pod ['"](?:react-native-maps|RNMaps)['"],\s*:path\s*=>\s*['"][^'"]*react-native-maps['"]\s*\n/gm,
        ""
      );

      // b) The Google Maps pods must live INSIDE the main app target so that
      //    CocoaPods links them into the correct binary. We insert them right
      //    after `use_expo_modules!` which is the first statement inside the
      //    target block in every Expo-generated Podfile.
      const googleMapsBlock = [
        "",
        "  # ── Google Maps (react-native-maps AirGoogleMaps subspec) ────────────",
        "  # react-native-maps@1.18.0 does not ship an Expo config plugin; we link",
        "  # the MapsGoogle subspec explicitly. :modular_headers is required for",
        "  # GoogleMaps/Google-Maps-iOS-Utils but NOT applied globally (that would",
        "  # break Hermes, react-native-agora, and react-native-reanimated).",
        "  pod 'react-native-maps', :path => '../node_modules/react-native-maps', :subspecs => ['MapsGoogle']",
        "  pod 'GoogleMaps', :modular_headers => true",
        "  pod 'Google-Maps-iOS-Utils', :modular_headers => true",
        "  # ─────────────────────────────────────────────────────────────────────",
        "",
      ].join("\n");

      // Insert after the `use_expo_modules!` line inside the target block.
      // Fallback: insert before the first `post_install` block.
      if (podfile.includes("use_expo_modules!")) {
        podfile = podfile.replace(
          /([ \t]*use_expo_modules!\n)/,
          `$1${googleMapsBlock}`
        );
      } else {
        // Fallback: insert before post_install
        podfile = podfile.replace(
          /^(post_install)/m,
          `${googleMapsBlock}\n$1`
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
}

/**
 * 2. AppDelegate modification
 *
 * Calls [GMSServices provideAPIKey:] (ObjC/ObjC++) or GMSServices.provideAPIKey()
 * (Swift) before the React Native boot sequence so the map SDK is initialised
 * before any MapView is mounted.
 */
function withGoogleMapsAppDelegate(config, apiKey) {
  return withAppDelegate(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const isSwift = cfg.modResults.language === "swift";

    if (isSwift) {
      // Swift AppDelegate
      if (!contents.includes("GMSServices.provideAPIKey")) {
        if (!contents.includes("import GoogleMaps")) {
          contents = `import GoogleMaps\n${contents}`;
        }
        contents = contents.replace(
          /(override func application\([^)]+didFinishLaunchingWithOptions[^)]+\)[^{]*\{)/,
          `$1\n    GMSServices.provideAPIKey("${apiKey}")`
        );
      }
    } else {
      // Objective-C / Objective-C++ AppDelegate (.mm)
      if (!contents.includes("GMSServices provideAPIKey")) {
        if (!contents.includes("<GoogleMaps/GoogleMaps.h>")) {
          contents = contents.replace(
            /#import "AppDelegate\.h"/,
            `#import "AppDelegate.h"\n#import <GoogleMaps/GoogleMaps.h>`
          );
        }
        // Inject before the [super application:...] return
        contents = contents.replace(
          /(return \[super application:application didFinishLaunchingWithOptions:launchOptions\];)/,
          `[GMSServices provideAPIKey:@"${apiKey}"];\n  $1`
        );
      }
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

/**
 * Root plugin — composes Podfile + AppDelegate modifiers.
 */
function withGoogleMapsIOS(config) {
  const apiKey = resolveApiKey(config);

  if (!apiKey) {
    console.warn(
      "[withGoogleMapsIOS] No Google Maps API key found.\n" +
        "  Set ios.config.googleMapsApiKey in app.json, or set the\n" +
        "  GOOGLE_API_KEY / EXPO_PUBLIC_GOOGLE_MAPS_API_KEY environment variable.\n" +
        "  Google Maps will fail to initialize at runtime without a valid key."
    );
  }

  config = withGoogleMapsPodfile(config);
  config = withGoogleMapsAppDelegate(config, apiKey);

  return config;
}

module.exports = withGoogleMapsIOS;
