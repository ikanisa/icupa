const isTestEnv =
  process.env.NODE_ENV === "test" ||
  (typeof process !== "undefined" && "VITEST" in process.env);

const disableAutoprefixer =
  isTestEnv ||
  (typeof process !== "undefined" && process.env.DISABLE_AUTOPREFIXER === "true");

export default {
  plugins: {
    tailwindcss: {},
    ...(disableAutoprefixer ? {} : { autoprefixer: {} }),
  },
};
