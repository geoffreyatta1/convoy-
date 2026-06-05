const appJson = require("./app.json");

const googleMapsApiKey = process.env.GOOGLE_API_KEY ?? "";

module.exports = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    config: {
      ...appJson.expo.android?.config,
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
  },
  ios: {
    ...appJson.expo.ios,
    config: {
      ...appJson.expo.ios?.config,
      // Setting googleMapsApiKey causes the react-native-maps Expo plugin to
      // include the Google Maps iOS SDK pod and AirGoogleMaps, enabling
      // PROVIDER_GOOGLE on iOS in EAS builds.
      googleMapsApiKey,
    },
  },
};
