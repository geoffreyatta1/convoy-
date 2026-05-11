// Vendor-patches RNCarPlay.m to add iOS 26 multitouch delegate support:
//   - Adds pinchZoom, twoFingerPitch, twoFingerRotate to supportedEvents.
//   - Implements CPMapTemplateDelegate multitouch methods (iOS 26 SDK, guarded).
// Must run after react-native-carplay is installed (prebuild only).

const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const RNCARPLAY_M_REL = "node_modules/react-native-carplay/ios/RNCarPlay.m";

// ── Supported-events insertion ────────────────────────────────────────────────
const EVENTS_ANCHOR = '"startedTrip",';
const EVENTS_PATCH = `"startedTrip",
        @"pinchZoom",
        @"twoFingerPitch",
        @"twoFingerRotate",`;

// ── iOS 26 delegate methods ───────────────────────────────────────────────────
const DELEGATES_ANCHOR = "# pragma SearchTemplate";
const DELEGATES_PATCH = `// iOS 26 CPMapTemplateDelegate multitouch extensions (CarPlay Ultra).
// Guarded by SDK version so the binary compiles on Xcode < 16.2 without error.
#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 260000
- (void)mapTemplate:(CPMapTemplate *)mapTemplate didChangePinchScaleTo:(CGFloat)scale velocity:(CGFloat)velocity {
    [self sendTemplateEventWithName:mapTemplate name:@"pinchZoom" json:@{ @"scale": @(scale) }];
}

- (void)mapTemplate:(CPMapTemplate *)mapTemplate didChangePitchAngleTo:(CGFloat)pitch {
    [self sendTemplateEventWithName:mapTemplate name:@"twoFingerPitch" json:@{ @"pitch": @(pitch) }];
}

- (void)mapTemplate:(CPMapTemplate *)mapTemplate didRotateToHeading:(CLLocationDirection)heading {
    [self sendTemplateEventWithName:mapTemplate name:@"twoFingerRotate" json:@{ @"heading": @(heading) }];
}
#endif

# pragma SearchTemplate`;

const withCarPlayMultitouchPatch = (config) =>
  withDangerousMod(config, [
    "ios",
    (config) => {
      const root = config.modRequest.projectRoot;
      const filePath = path.join(root, RNCARPLAY_M_REL);

      if (!fs.existsSync(filePath)) {
        console.warn("[withCarPlayMultitouchPatch] RNCarPlay.m not found — skipping patch.");
        return config;
      }

      let src = fs.readFileSync(filePath, "utf8");

      if (!src.includes("pinchZoom")) {
        src = src.replace(EVENTS_ANCHOR, EVENTS_PATCH);
      }

      if (!src.includes("didChangePinchScaleTo")) {
        src = src.replace(DELEGATES_ANCHOR, DELEGATES_PATCH);
      }

      fs.writeFileSync(filePath, src, "utf8");
      return config;
    },
  ]);

module.exports = withCarPlayMultitouchPatch;
