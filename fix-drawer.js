const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

const drawerMediaRegex = /@media\s*\(max-width:\s*1000px\)\s*{[\s\S]*?\.note-textarea:focus\s*{[^}]*}\s*}/m;
const newMedia = `@media (max-width: 1000px) {
  .modal-wrapper {
    flex-direction: column;
    align-items: center;
    max-height: 85vh; /* match the original modal-content max height */
    width: 100%;
  }
  
  .modal-content {
    max-height: none; /* let the wrapper control the height constraints */
    flex: 1; /* allow it to shrink dynamically */
    min-height: 0; /* critical for flex shrinking */
    width: 100%;
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

css = css.replace(drawerMediaRegex, newMedia);
fs.writeFileSync('src/app/globals.css', css);
