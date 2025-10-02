import esbuild from "esbuild";

esbuild.build({
  entryPoints: ["Frontend/src/index.jsx"],
  bundle: true,
  outfile: "Frontend/dist/bundle.js",
  loader: {
    ".png": "file",
    ".jpg": "file",
    ".jpeg": "file",
    ".svg": "file",
    ".css": "css",
  },
})