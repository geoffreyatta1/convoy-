// Writes CarPlayDashboardSceneDelegate.swift and
// CarPlayInstrumentClusterSceneDelegate.swift into ios/<ProjectName>/ and adds
// them to the Xcode build target. Required so the UISceneDelegate class names
// declared in Info.plist by withCarPlay.js resolve at runtime.

const { withXcodeProject, withDangerousMod, IOSConfig } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const FILES = {
  // ── Main application window scene ─────────────────────────────────────────
  // iOS requires a UIWindowSceneSessionRoleApplication entry in the
  // UIApplicationSceneManifest whenever any CPTemplateApplication* scene
  // entries are present. That entry references this class.
  //
  // React Native (RCTAppDelegate / EXAppDelegateWrapper) creates the root
  // UIWindow in application:didFinishLaunchingWithOptions: before any scene
  // delegate fires. Here we simply adopt that window and attach it to the
  // incoming UIWindowScene so the app renders correctly under scene-based
  // lifecycle while CarPlay scenes are active.
  "SceneDelegate.swift": `import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    // Adopt the window that RCTAppDelegate already configured and bind it
    // to this UIWindowScene so the React Native root view is visible.
    if let existingWindow = UIApplication.shared.delegate?.window ?? nil {
      window = existingWindow
      window?.windowScene = windowScene
    }
  }
}
`,

  "CarPlayDashboardSceneDelegate.swift": `import CarPlay

class CarPlayDashboardSceneDelegate: UIResponder, CPTemplateApplicationDashboardSceneDelegate {

  func templateApplicationDashboardScene(
    _ dashboardScene: CPTemplateApplicationDashboardScene,
    didConnect dashboardController: CPDashboardController,
    to window: UIWindow
  ) {
    // Dashboard connected — system renders the MapTemplate in the Dashboard strip.
    // react-native-carplay manages all template state; no additional wiring required.
  }

  func templateApplicationDashboardScene(
    _ dashboardScene: CPTemplateApplicationDashboardScene,
    didDisconnectDashboardController dashboardController: CPDashboardController,
    from window: UIWindow
  ) {
    // Dashboard disconnected.
  }
}
`,
  "CarPlayInstrumentClusterSceneDelegate.swift": `import CarPlay

class CarPlayInstrumentClusterSceneDelegate: UIResponder, CPTemplateApplicationInstrumentClusterSceneDelegate {

  func templateApplicationInstrumentClusterScene(
    _ instrumentClusterScene: CPTemplateApplicationInstrumentClusterScene,
    didConnect instrumentClusterController: CPInstrumentClusterController
  ) {
    // Instrument cluster connected — system renders the navigation view in the cluster.
    // react-native-carplay manages all template state; no additional wiring required.
  }

  func templateApplicationInstrumentClusterSceneDidDisconnect(
    _ instrumentClusterScene: CPTemplateApplicationInstrumentClusterScene
  ) {
    // Instrument cluster disconnected.
  }
}
`,
};

const withCarPlaySceneDelegates = (config) => {
  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const projectName = config.modRequest.projectName;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const destDir = path.join(platformProjectRoot, projectName);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      for (const [filename, source] of Object.entries(FILES)) {
        fs.writeFileSync(path.join(destDir, filename), source, "utf8");
      }

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    for (const filename of Object.keys(FILES)) {
      const filePath = path.join(projectName, filename);

      const alreadyAdded = xcodeProject.pbxFileReferenceSection
        ? Object.values(xcodeProject.pbxFileReferenceSection()).some(
            (ref) =>
              ref &&
              typeof ref === "object" &&
              ref.path &&
              ref.path.includes(filename),
          )
        : false;

      if (!alreadyAdded) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: filePath, groupName: projectName, project: xcodeProject });
      }
    }

    return config;
  });

  return config;
};

module.exports = withCarPlaySceneDelegates;
