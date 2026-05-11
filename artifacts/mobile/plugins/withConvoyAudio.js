// Writes ConvoyAudioModule.swift into ios/<ProjectName>/ and adds it to the
// Xcode build target so the native AVAudioSession bridge compiles into the app.

const { withXcodeProject, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const SWIFT_SOURCE = `import ExpoModulesCore
import AVFoundation

public class ConvoyAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ConvoyAudio")

    AsyncFunction("activateVoicePromptSession") { (promise: Promise) in
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
          .playback,
          mode: .voicePrompt,
          options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers]
        )
        try session.setActive(true)
        promise.resolve()
      } catch {
        promise.reject(error)
      }
    }

    AsyncFunction("deactivateVoicePromptSession") { (promise: Promise) in
      do {
        try AVAudioSession.sharedInstance().setActive(
          false,
          options: .notifyOthersOnDeactivation
        )
        promise.resolve()
      } catch {
        promise.reject(error)
      }
    }
  }
}
`;

const SWIFT_FILENAME = "ConvoyAudioModule.swift";

const withConvoyAudio = (config) => {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectName = config.modRequest.projectName;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const destDir = path.join(platformProjectRoot, projectName);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const destPath = path.join(destDir, SWIFT_FILENAME);
      fs.writeFileSync(destPath, SWIFT_SOURCE, "utf8");

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    const swiftFilePath = path.join(projectName, SWIFT_FILENAME);

    const alreadyAdded = xcodeProject.pbxFileReferenceSection
      ? Object.values(xcodeProject.pbxFileReferenceSection()).some(
          (ref) =>
            ref &&
            typeof ref === "object" &&
            ref.path &&
            ref.path.includes(SWIFT_FILENAME),
        )
      : false;

    if (!alreadyAdded) {
      xcodeProject.addSourceFile(swiftFilePath, {}, xcodeProject.getFirstTarget().uuid);
    }

    return config;
  });

  return config;
};

module.exports = withConvoyAudio;
