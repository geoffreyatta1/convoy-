// Expo config plugin to add Android Auto support to the Android app.
// Android Auto navigation apps must declare automotive_app_desc metadata
// in the AndroidManifest and provide an XML descriptor.

const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const AUTOMOTIVE_DESC_XML = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <!--
        Declares this as a navigation (turn-by-turn) Android Auto app.
        Valid values: "navigation", "media", "notification", "iot", "video"
    -->
    <uses name="navigation"/>
</automotiveApp>
`;

/**
 * Writes res/xml/automotive_app_desc.xml and adds the required metadata to
 * the application node of AndroidManifest.xml.
 */
function withAndroidAuto(config) {
  // Step 1: Write the XML resource file
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml"
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, "automotive_app_desc.xml"),
        AUTOMOTIVE_DESC_XML
      );
      return cfg;
    },
  ]);

  // Step 2: Add <meta-data> to AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;

    if (!application["meta-data"]) {
      application["meta-data"] = [];
    }

    const metaKey = "com.google.android.gms.car.application";
    const already = application["meta-data"].some(
      (m) => m.$?.["android:name"] === metaKey
    );
    if (!already) {
      application["meta-data"].push({
        $: {
          "android:name": metaKey,
          "android:resource": "@xml/automotive_app_desc",
        },
      });
    }

    return cfg;
  });

  return config;
}

module.exports = withAndroidAuto;
