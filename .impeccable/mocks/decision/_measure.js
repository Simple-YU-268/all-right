const { chromium } = require("playwright");
(async () => {
  for (const f of ["pick.html","grounded.html"]) {
    const b = await chromium.launch({ channel: "msedge" });
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto("file:///C:/Users/yy197/Desktop/Kuku/.impeccable/mocks/decision/" + f);
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll(".lcol,.rcol,.rail,.bar,.top,.app").forEach(el => {
        out.push({ sel: el.className, sh: el.scrollHeight, ch: el.clientHeight, over: el.scrollHeight - el.clientHeight });
      });
      const de = document.documentElement;
      return { rows: out, docOver: de.scrollHeight - de.clientHeight };
    });
    console.log("=== " + f + " docOver=" + r.docOver);
    r.rows.forEach(x => console.log("   " + x.sel.padEnd(8) + " sh=" + x.sh + " ch=" + x.ch + " over=" + x.over));
    await b.close();
  }
})();
