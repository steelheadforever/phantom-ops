/**
 * ReadmePanel — a scrollable in-app user guide hosted in the side panel.
 * Pushed onto the SideMenu view stack when the user clicks README.
 */
export class ReadmePanel {
  constructor() {
    this._sideMenu = null;    // set via late binding
    this.el = null;
  }

  mount() {
    const el = document.createElement('div');
    el.className = 'readme-panel';

    const back = document.createElement('button');
    back.className = 'panel-back-btn';
    back.innerHTML = '&#8249; README';
    back.addEventListener('click', () => this._sideMenu?.popView());
    el.appendChild(back);

    const body = document.createElement('div');
    body.className = 'readme-body';
    body.innerHTML = this._content();
    el.appendChild(body);

    this.el = el;
    return this;
  }

  _content() {
    return `

        <h2>Welcome to Phantom Ops</h2>
        <p>Phantom Ops is an unclassified mission planning tool built for the 558th Flying Training Squadron (558 FTS) at Joint Base San Antonio-Randolph. It runs in any modern web browser — no install required.</p>
        <p><strong>This tool is for simulator training planning only. Do not enter classified information.</strong></p>

        <h2>The Map</h2>
        <p>The map defaults to the Randolph AFB area. You can pan by clicking and dragging and zoom with the scroll wheel (or pinch on touch screens).</p>

        <h3>Base Charts</h3>
        <p>Tap the <strong>map icon</strong> in the bottom bar to switch between chart types:</p>
        <ul>
          <li><strong>Satellite</strong> — high-resolution aerial imagery (default)</li>
          <li><strong>Terrain</strong> — topographic map</li>
          <li><strong>Street Map</strong> — road/city map</li>
          <li><strong>VFR Sectional</strong> — FAA VFR sectional chart</li>
          <li><strong>VFR Terminal</strong> — FAA terminal area chart</li>
          <li><strong>IFR Low / IFR High</strong> — FAA instrument en-route charts</li>
        </ul>

        <h3>Airspace Layers</h3>
        <p>Tap the <strong>quadrilateral icon</strong> in the bottom bar to toggle airspace overlays:</p>
        <ul>
          <li><strong>Class B</strong> — blue shaded area (major airports, e.g. San Antonio)</li>
          <li><strong>Class C</strong> — medium blue (regional airports)</li>
          <li><strong>Class D</strong> — dark blue (smaller towered airports)</li>
          <li><strong>MOAs</strong> — orange (Military Operations Areas)</li>
          <li><strong>Alert Areas</strong> — yellow (high density military training)</li>
          <li><strong>Restricted Areas</strong> — red (prohibited without clearance)</li>
          <li><strong>Kill Box</strong> — gray CGRS grid (30-min boxes, e.g. 419NV; keypads 1–9)</li>
          <li><strong>Navaids</strong> — VOR, VORTAC, TACAN, NDB navigation aids</li>
          <li><strong>IFR Fixes</strong> — named IFR intersection points</li>
          <li><strong>Airfields</strong> — airport markers</li>
          <li><strong>Legend</strong> — check to show a color/symbol reference in the lower-left</li>
        </ul>

        <h3>Brightness</h3>
        <p>The <strong>sun icon</strong> in the bottom bar opens a brightness slider to dim the map for low-light environments.</p>

        <h2>Kill Box (CGRS) Grid</h2>
        <p>The gray grid overlay is the <strong>CGRS (Coded Identification Grids)</strong> system used for kill box identification.</p>
        <ul>
          <li>Each <strong>30-minute cell</strong> has a code like <code>419NV</code> (column number + row letters)</li>
          <li>Each cell divides into <strong>nine 10-minute keypads</strong> numbered 1–9 using telephone layout (1 = NW, 5 = center, 9 = SE)</li>
          <li>Full kill box reference: <code>419NV5</code> means the center keypad of kill box 419NV</li>
          <li>Zoom in to see individual keypads labeled on the chart</li>
        </ul>

        <h2>Bottom Bar</h2>
        <ul>
          <li><strong>Coordinate display</strong> — shows cursor position; click to cycle between DD, DMS, DMM, and MGRS formats</li>
          <li><strong>Scratchpad</strong> — type quick notes, then copy or clear</li>
          <li><strong>Search box</strong> — type a navaid/fix identifier (e.g. <code>SAT</code>) and press GO to fly to it</li>
          <li><strong>Ruler</strong> — click to start measuring distances on the map; right-click to cancel</li>
          <li><strong>Clock</strong> — displays current UTC time (Zulu)</li>
          <li><strong>SOURCES</strong> — indicates whether chart tile sources are reachable (OK / LIM / BAD)</li>
        </ul>

        <h2>Context Menu (i button)</h2>
        <p>Tap the <strong>i</strong> button in the top bar (touch devices) or use it on desktop, then click anywhere on the map to get a context menu showing:</p>
        <ul>
          <li>Coordinates at that point (in current format)</li>
          <li>Nearby airspace boundaries and their names</li>
          <li>Option to start a range/bearing measurement from that point</li>
        </ul>

        <h2>Drawing Shapes (PLAN menu)</h2>
        <p>Open the side menu (hamburger ☰ button), then tap <strong>PLAN → Draw Shapes</strong> to access drawing tools.</p>

        <h3>Circle</h3>
        <ol>
          <li>Tap <strong>Circle</strong> — the popup opens with Name, Color, and Transparency options</li>
          <li>Click the map to place the <strong>center</strong></li>
          <li>Move your cursor outward and click again to set the <strong>radius</strong></li>
          <li>The popup becomes fully editable — adjust location, radius (nm), color, transparency, description, and altitude</li>
          <li>Tap <strong>Done</strong> to save</li>
        </ol>

        <h3>Polygon</h3>
        <ol>
          <li>Tap <strong>Polygon</strong> and set a name/color</li>
          <li>Click multiple points on the map to define corners</li>
          <li>Click near the <strong>first point</strong> to close the polygon</li>
          <li>Edit corners in the popup table; drag corner markers to adjust</li>
        </ol>

        <h3>Line</h3>
        <ol>
          <li>Tap <strong>Line</strong>, set name/color/dash style</li>
          <li>Click the map to place each waypoint along the route</li>
          <li>Right-click (or toggle <strong>PLACE: OFF</strong>) to stop adding points</li>
          <li>Use the <strong>eye icon</strong> next to Name to display the name as a label on the line</li>
        </ol>

        <h3>Point</h3>
        <ol>
          <li>Tap <strong>Point</strong>, choose a name, symbol, and color</li>
          <li>Click the map to place it</li>
          <li>Use the <strong>eye icon</strong> to show the name as a map label</li>
        </ol>

        <h3>Managing Shapes</h3>
        <ul>
          <li>The <strong>Draw Shapes</strong> panel lists all shapes — tap the eye icon to toggle visibility</li>
          <li>Tap <strong>⋮</strong> (three dots) next to a shape to Edit or Delete it</li>
          <li>Drag shapes in the list to reorder their drawing order (stacking)</li>
          <li>All shapes are saved in your browser and survive page reloads</li>
        </ul>

        <h3>Description &amp; Altitude</h3>
        <p>Each shape has optional <strong>Description</strong> and <strong>Altitude</strong> fields in its popup. Check the <em>Altitude</em> checkbox to enable the altitude annotation. Circles and polygons support a floor and ceiling; lines and points support a single altitude value (all in ft MSL).</p>

        <h2>Study Menu</h2>
        <p>Open the side menu and tap <strong>STUDY</strong> to access:</p>
        <ul>
          <li><strong>Boldface</strong> — emergency procedure memory items</li>
          <li><strong>Ops Limits</strong> — aircraft operating limits reference</li>
        </ul>

        <h2>Tips</h2>
        <ul>
          <li>Coordinate inputs in shape popups accept <strong>MGRS, DMS, DMM, or decimal degrees</strong> — just type your coordinates and press Enter</li>
          <li>The ruler tool shows <strong>distance in nautical miles</strong> and <strong>magnetic bearing</strong></li>
          <li>VFR/IFR charts have a maximum native tile resolution — the map will upscale if you zoom in further, which may appear blurry</li>
          <li>Use <strong>Reset Data</strong> at the bottom of the side menu to clear all your saved drawings if needed</li>
        </ul>

        <p class="readme-footer">Phantom Ops — 558 FTS | UNCLASSIFIED // FOR TRAINING USE ONLY</p>
    `;
  }
}
