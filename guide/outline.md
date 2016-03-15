**[v1]** Basic monochrome local whiteboard + clear screen
<ol>
<li> Setup node + express </li>
<li> `index.js` setup </li>
<li> `index.html` styling and whiteboard div </li>
<li> Size the canvas, set canvas line styling </li>
<li> Line drawing strategy: connecting points from `mousemove` event when `mousedown` </li>
<li> Event handlers (without `mouseleave` handling, `mouseup` not hooked to `document`) </li>
<li> Handle mouse leaving canvas space and desired behaviour </li>
<li> Suggestions for enhancement (see v1/commands.txt) </li>
</ol>
**[v2]** Show other connected users drawing in real time + number of users connected
<ol>
<li> Install socket.io (npm and html script inclusion) </li>
<li> Restructure app directories and files + update `index.js` GET service code </li>
<li> Have node server track count of connected users </li>
<li> Add client-side user count display code </li>
<li> Setup `socket.io` events to synchronise user counts </li>
<li> Handle drawing across different overlapping child elements mapping to correct position on canvas </li>
<li> Abstract out drawLine() and setup `socket.io` events to synchronise strokes </li>
<li> Suggestions for enhancement (see v2/commands.txt) </li>
</ol>
**[v3]** Can choose color + color picker
<ol>
<li> Extract stylesheet as separate file </li>
<li> Add and style html5 color input </li>
<li> Add `onchange` callback for the color input </li>
<li> Add color field to line objects being passed around </li>
<li> Code for updating canvas stroke color </li>
<li> Suggestions for enhancement (see v3/commands.txt) </li>
</ol>
**[v4]** 3d particle effects
<ol>
<li> Include `THREE.js` and `GPUParticleSystem.js` scripts </li>
<li> Add texture image files for particle system use </li>
<li> Setup particle gfx system in `whiteboard.js` </li>
<li> Animation strategy: each line segment drawn will emit particles once </li>
<li> Modify `drawLine` to push newly created lines to a store </li>
<li> `animate` code (consumes new lines from store) </li>
<li> Suggestions for enhancement (see v4/commands.txt) </li>
</ol>