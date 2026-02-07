/** @type {import('tailwindcss').Config} */
// module.exports = {
//   content: ["./**/*.tsx"],
//   theme: {
//     extend: {}
//   },
//   plugins: []
// }

/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: [
    "./*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./background/**/*.{ts,tsx}"
  ],
  plugins: []
}
