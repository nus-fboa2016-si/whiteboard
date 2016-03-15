* **[v1]** Basic monochrome local whiteboard + clear screen
    1. Setup node + express
    2. `index.js` setup
    3. `index.html` styling and whiteboard div
    4. Size the canvas, set canvas line styling
    5. Line drawing strategy: connecting points from `mousemove` event when `mousedown`
    6. Event handlers (without `mouseleave` handling, `mouseup` not hooked to `document`)
    7. Handle mouse leaving canvas space and desired behaviour
    8. Suggestions for enhancement (see v1/commands.txt)
    
* **[v2]** Show other connected users drawing in real time + number of users connected
    1. Install socket.io (npm and html script inclusion)
    2. Restructure app directories and files + update `index.js` GET service code
    3. Have node server track count of connected users
    4. Add client-side user count display code
    5. Setup `socket.io` events to synchronise user counts
    6. Handle drawing across different overlapping child elements mapping to correct position on canvas
    7. Abstract out drawLine() and setup `socket.io` events to synchronise strokes
    8. Suggestions for enhancement (see v2/commands.txt)

* **[v3]** Can choose color + color picker
    1. Extract stylesheet as separate file
    2. Add and style html5 color input
    3. Add `onchange` callback for the color input
    4. Add color field to line objects being passed around
    5. Code for updating canvas stroke color
    6. Suggestions for enhancement (see v3/commands.txt)

* **[v4]** 3d particle effects
    1. Include `THREE.js` and `GPUParticleSystem.js` scripts
    2. Add texture image files for particle system use
    3. Setup particle gfx system in `whiteboard.js`
    4. Animation strategy: each line segment drawn will emit particles once
    5. Modify `drawLine` to push newly created lines to a store
    6. `animate` code (consumes new lines from store)
    7. Suggestions for enhancement (see v4/commands.txt)