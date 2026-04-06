const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// The block has box-shadow: 0 24px 80px
css = css.replace(/overflow:\s*hidden;\s*box-shadow:\s*0 24px 80px/g, 'overflow: visible;\n  box-shadow: 0 24px 80px');

fs.writeFileSync('src/app/globals.css', css);
console.log("Updated globals.css overflow constraint");
