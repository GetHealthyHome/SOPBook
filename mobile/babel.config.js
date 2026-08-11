module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last: the Reanimated plugin rewrites worklet functions and
    // has to see the output of every other transform.
    plugins: ['react-native-reanimated/plugin'],
  };
};
