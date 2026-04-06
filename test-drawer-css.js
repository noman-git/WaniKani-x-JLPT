const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// replace the entire @media (max-width: 1000px) notes drawer block
const drawerMediaRegex = /@media\s*\(max-width:\s*1000px\)\s*{[\s\S]*?\.note-textarea:focus\s*{[^}]*}\s*}/m;
const newMedia = `@media (max-width: 1000px) {
  .modal-wrapper {
    flex-direction: column;
    align-items: center;
    max-height: 90vh; /* total modal wrapper max-height */
    overflow-y: auto; /* let it scroll as a whole if combined height is huge */
  }
  
  .modal-content {
    max-height: none; /* let it stretch naturally, wrapper scrolls it */
    flex-shrink: 0;
  }

  .modal-notes-drawer {
    position: relative;
    top: auto;
    bottom: auto;
    left: auto;
    right: auto;
    width: 100%;
    height: auto;
    max-height: none;
    margin-top: 16px;
    transform: none !important;
    z-index: 10;
    box-shadow: var(--shadow-card);
    border-radius: var(--radius-xl);
    flex-shrink: 0;
    display: none; /* hidden if not open */
  }
  
  .modal-notes-drawer.open {
    display: flex;
    opacity: 1;
  }
  
  .note-textarea {
    min-height: 48px;
    height: 48px;
  }
  
  .note-textarea:focus {
    min-height: 120px;
    height: 120px;
  }
}`;

if (drawerMediaRegex.test(css)) {
  css = css.replace(drawerMediaRegex, newMedia);
  fs.writeFileSync('src/app/globals.css', css);
  console.log("Updated media query");
} else {
  console.log("Could not find media query to replace");
}
