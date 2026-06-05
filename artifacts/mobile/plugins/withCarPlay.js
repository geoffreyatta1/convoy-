// Expo config plugin to add CarPlay entitlements to the iOS app.
//
// ─── IMPORTANT: CarPlay Entitlement Approval Required ───────────────────────
//
// The `com.apple.developer.carplay-navigation` entitlement declared below is
// NOT automatically granted. You must apply for it manually through Apple's
// CarPlay entitlement request programme:
//
//   https://developer.apple.com/contact/request/carplay/
//
// When filling in the form:
//   • App type:  Navigation
//   • Describe the app as: "A navigation app for coordinating groups of
//     vehicles driving to a shared destination. Shows turn-by-turn directions,
//     real-time vehicle positions, and gap alerts on the CarPlay display."
//   • Attach screenshots of the CarPlay interface (see app-store-metadata/ for
//     the four required screens).
//   • SDK used: react-native-carplay (MapTemplate, ListTemplate, AlertTemplate,
//     InformationTemplate, VoiceControlTemplate, CPNavigationSession with CPManeuver)
//
// Without this entitlement your app will build and run in the iOS Simulator
// CarPlay window during development, but will be REJECTED during App Store
// review.
//
// You already have the CarPlay Communications entitlement — mention this in
// the form as it signals you are already an approved CarPlay developer.
// ────────────────────────────────────────────────────────────────────────────

const { withEntitlementsPlist, withInfoPlist } = require("@expo/config-plugins");

/**
 * Adds CarPlay entitlements and Info.plist entries required for a navigation app.
 *
 * Feb 2026 CarPlay Developer Guide compliance:
 *  - CPSupportsDashboardNavigationScene: map appears in CarPlay Dashboard
 *  - CPSupportsInstrumentClusterNavigationScene: map appears in instrument cluster
 *  - Two corresponding UISceneConfigurations entries for Dashboard + Cluster scenes
 *
 * Usage: add "plugins": ["./plugins/withCarPlay"] to app.json
 */
function withCarPlay(config) {
  // 1. Add navigation entitlement
  config = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults["com.apple.developer.carplay-navigation"] = true;
    return cfg;
  });

  // 2. Add Info.plist keys required by CarPlay
  config = withInfoPlist(config, (cfg) => {
    if (!cfg.modResults.UIApplicationSceneManifest) {
      cfg.modResults.UIApplicationSceneManifest = {};
    }
    const manifest = cfg.modResults.UIApplicationSceneManifest;

    // Must be false — the app does not support multiple windows on iPhone.
    manifest.UIApplicationSupportsMultipleScenes = false;

    // ── Dashboard and Instrument Cluster support ──────────────────────────────
    // Required by the Feb 2026 CarPlay Developer Guide so the map view appears
    // in the CarPlay Dashboard (bottom strip while music/maps share the screen)
    // and in the vehicle instrument cluster (if the car supports it).
    manifest.CPSupportsDashboardNavigationScene = true;
    manifest.CPSupportsInstrumentClusterNavigationScene = true;

    if (!manifest.UISceneConfigurations) {
      manifest.UISceneConfigurations = {};
    }
    const scenes = manifest.UISceneConfigurations;

    // ── Main iPhone window scene ──────────────────────────────────────────────
    // iOS REQUIRES a UIWindowSceneSessionRoleApplication entry whenever any
    // CPTemplateApplication* entries are present. Without it iOS cannot create
    // the main app window under scene-based lifecycle, breaking CarPlay session
    // establishment entirely.
    // SceneDelegate.swift (written by withCarPlaySceneDelegates) adopts the
    // RCTAppDelegate-managed window and attaches it to the UIWindowScene.
    if (!scenes.UIWindowSceneSessionRoleApplication) {
      scenes.UIWindowSceneSessionRoleApplication = [
        {
          UISceneConfigurationName: "Default Configuration",
          UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
        },
      ];
    }

    // ── Main CarPlay scene ────────────────────────────────────────────────────
    if (!scenes.CPTemplateApplicationSceneSessionRoleApplication) {
      scenes.CPTemplateApplicationSceneSessionRoleApplication = [
        {
          UISceneConfigurationName: "CarPlay",
          UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate",
          UISceneSessionRoleApplication:
            "CPTemplateApplicationSceneSessionRoleApplication",
        },
      ];
    }

    // ── Dashboard scene ───────────────────────────────────────────────────────
    // Displays the navigation map in the CarPlay Dashboard (iOS 13.4+).
    if (!scenes.CPTemplateApplicationDashboardSceneSessionRoleApplication) {
      scenes.CPTemplateApplicationDashboardSceneSessionRoleApplication = [
        {
          UISceneConfigurationName: "CarPlay-Dashboard",
          UISceneDelegateClassName:
            "$(PRODUCT_MODULE_NAME).CarPlayDashboardSceneDelegate",
          UISceneSessionRoleApplication:
            "CPTemplateApplicationDashboardSceneSessionRoleApplication",
        },
      ];
    }

    // ── Instrument Cluster scene ──────────────────────────────────────────────
    // Displays a simplified map view in the vehicle instrument cluster (iOS 15.4+).
    if (!scenes.CPTemplateApplicationInstrumentClusterSceneSessionRoleApplication) {
      scenes.CPTemplateApplicationInstrumentClusterSceneSessionRoleApplication = [
        {
          UISceneConfigurationName: "CarPlay-InstrumentCluster",
          UISceneDelegateClassName:
            "$(PRODUCT_MODULE_NAME).CarPlayInstrumentClusterSceneDelegate",
          UISceneSessionRoleApplication:
            "CPTemplateApplicationInstrumentClusterSceneSessionRoleApplication",
        },
      ];
    }

    return cfg;
  });

  return config;
}

module.exports = withCarPlay;
