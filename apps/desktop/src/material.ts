import "@material/web/button/filled-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/checkbox/checkbox.js";
import "@material/web/chips/assist-chip.js";
import "@material/web/divider/divider.js";
import "@material/web/icon/icon.js";
import "@material/web/list/list.js";
import "@material/web/list/list-item.js";
import "@material/web/progress/circular-progress.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/switch/switch.js";
import "@material/web/tabs/primary-tab.js";
import "@material/web/tabs/tabs.js";
import "@material/web/textfield/outlined-text-field.js";
import { styles as typescaleStyles } from "@material/web/typography/md-typescale-styles.js";

const typeScaleSheet = typescaleStyles.styleSheet;

if (typeScaleSheet) {
  document.adoptedStyleSheets.push(typeScaleSheet);
}
