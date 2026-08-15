// Final width-consistency fixes: supplier pages family.
const fs = require("fs");

function patch(file, pairs) {
  let src = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const [from, to] of pairs) {
    while (src.includes(from)) {
      src = src.replace(from, to);
      n++;
    }
  }
  fs.writeFileSync(file, src);
  console.log(`${file}: ${n} replacements`);
}

// supplier-partnership: unify on 6xl (body sections already 6xl)
patch("app/(marketing)/supplier-partnership/page.tsx", [
  ['<div className="mx-auto max-w-4xl px-6 lg:px-8">', '<div className="mx-auto max-w-6xl px-6 lg:px-8">'],
  ['<div className="mx-auto max-w-4xl px-6 text-center lg:px-8">', '<div className="mx-auto max-w-6xl px-6 lg:px-8">'],
  ['<div className="mx-auto max-w-3xl px-6 text-center lg:px-8">', '<div className="mx-auto max-w-6xl px-6 lg:px-8">'],
]);

// suppliers-info: unify on 5xl (body sections already 5xl)
patch("app/(marketing)/suppliers-info/page.tsx", [
  ['<div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">', '<div className="relative mx-auto max-w-5xl px-6 lg:px-8">'],
  ['<div className="mx-auto max-w-3xl px-6 lg:px-8">', '<div className="mx-auto max-w-5xl px-6 lg:px-8">'],
]);

// suppliers directory: unify on 5xl (body already 5xl)
patch("app/(marketing)/suppliers/page.tsx", [
  ['<div className="relative mx-auto max-w-4xl px-4 text-center md:px-6 lg:px-8">', '<div className="relative mx-auto max-w-5xl px-4 md:px-6 lg:px-8">'],
  ['<div className="mx-auto max-w-4xl px-4 text-center md:px-6 lg:px-8">', '<div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">'],
]);

// supplier catalogue: empty-state banner align to 6xl body
patch("app/(marketing)/suppliers/[slug]/catalogue/page.tsx", [
  ['<div className="mx-auto max-w-3xl px-4 py-20 text-center">', '<div className="mx-auto max-w-6xl px-4 py-20 text-center">'],
]);
