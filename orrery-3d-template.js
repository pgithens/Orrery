"use strict";

var gl;
var canvas;

var printDay;

var mvMatrix;

// common modelview projection matrix
var commonMVMatrix;

// matrix stack
var stack = [];

var a_positionLoc;
var a_vNormalLoc
var u_colorLoc;
var u_mvMatrixLoc;

// Last time that this function was called
var g_last = Date.now();
var elapsed = 0;
var mspf = 1000/30.0;  // ms per frame

// scale factors
var rSunMult = 45;      // keep sun's size manageable
var rPlanetMult = 2000;  // scale planet sizes to be more visible

// surface radii (km)
var rSun = 696000;
var rMercury = 2440;
var rVenus = 6052;
var rEarth = 6371;
var rMoon = 1737;

// orbital radii (km)
var orMercury = 57909050;
var orVenus = 108208000;
var orEarth = 149598261;
var orMoon = 384399;

// orbital periods (Earth days)
var pMercury = 88;
var pVenus = 225;
var pEarth = 365;
var pMoon = 27;

// time
var currentDay;
var daysPerFrame;

var globalScale;

// vertices
var circleVertexPositionData = []; // for orbit
var sphereVertexPositionData = []; // for planet
var sphereVertexIndexData = []; // for planet

var circleVertexPositionBuffer;
var sphereVertexPositionBuffer;
var sphereVertexIndexBuffer;

// for trackball
var m_inc;
var m_curquat;
var m_mousex = 1;
var m_mousey = 1;
var trackballMove = false;

// for trackball
function mouseMotion( x,  y)
{
        var lastquat;
        if (m_mousex != x || m_mousey != y)
        {
            lastquat = trackball(
                  (2.0*m_mousex - canvas.width) / canvas.width,
                  (canvas.height - 2.0*m_mousey) / canvas.height,
                  (2.0*x - canvas.width) / canvas.width,
                  (canvas.height - 2.0*y) / canvas.height);
            m_curquat = add_quats(lastquat, m_curquat);
            m_mousex = x;
            m_mousey = y;
        }
}

// Lighting
var normalsArray = [];

// point light (assume in object space)
var lightPosition = vec4( 0.0, 0.0, 100.0, 1.0 );

var lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
var lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0 );
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0 );

var ambientProduct;
var diffuseProduct;
var specularProduct;

var materialShininess = 20.0;

var modelViewMatrix;
var u_modelViewMatrixLoc;
var u_ambientProductLoc, u_diffuseProductLoc, u_specularProductLoc;

var u_nMatrixLoc;

var sphereVertexNormalBuffer;

var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

var u_useLightingLoc;


1.15, 1, 0.1, 1000.0

var left = -1.15;
var right = 1;
var ytop = 0.1;
var bottom = 1000.0;
var near = -10;
var far = 10;

var redRGB = 1.0;
var greenRGB = 1.0;
var blueRGB = 1.0;

// Texture
var a_TextureCoordLoc;
var u_TextureSamplerLoc;

var earthTexture;
var sunTexture;
var mercuryTexture;
var venusTexture;
var moonTexture;

var textureCoordData = [];
var textureCoordBuffer;

var earthRotate = 0.0;
var earthRotPerFrame;




window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );
    printDay = document.getElementById("printDay");

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.2, 0.2, 0.2, 1.0 );

    gl.enable(gl.DEPTH_TEST);

    currentDay = 0;
    daysPerFrame = 0.0625; //1.0;

    // global scaling for the entire orrery
    globalScale = 27.0 / ( orEarth + orMoon + ( rEarth + 2 * rMoon ) * rPlanetMult );

    setupCircle();

    setupSphere();

    initTexture();

    // for trackball
    m_curquat = trackball(0, 0, 0, 0);

    //  Load shaders and initialize attribute buffers

    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );


    ambientProduct = lightAmbient;
    diffuseProduct = lightDiffuse;
    specularProduct = lightSpecular;

    // Load the data into the GPU

    circleVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, circleVertexPositionBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(circleVertexPositionData), gl.STATIC_DRAW );

    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVertexPositionData), gl.STATIC_DRAW);

    sphereVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphereVertexIndexData), gl.STATIC_DRAW);

    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW );

    textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(textureCoordData), gl.STATIC_DRAW );

    gl.activeTexture(gl.TEXTURE0);
    u_TextureSamplerLoc = gl.getUniformLocation(program, "u_TextureSampler");
    gl.uniform1i(u_TextureSamplerLoc, 0);

    // Associate out shader variables with our data buffer

    a_positionLoc = gl.getAttribLocation( program, "a_vPosition" );
    a_vNormalLoc = gl.getAttribLocation(program, "a_vNormal" );
    u_colorLoc = gl.getUniformLocation( program, "u_color" );

    u_mvMatrixLoc = gl.getUniformLocation( program, "u_mvMatrix" );
    u_useLightingLoc = gl.getUniformLocation(program, "u_UseLighting");
    u_nMatrixLoc = gl.getUniformLocation(program, "u_nMatrix" );

    u_ambientProductLoc = gl.getUniformLocation( program, "u_ambientProduct" );
    u_diffuseProductLoc =  gl.getUniformLocation( program, "u_diffuseProduct" );
    u_specularProductLoc = gl.getUniformLocation( program, "u_specularProduct" );

    var projMatrix = perspective(15, 2.0, 0.1, 1000.0);

    gl.uniformMatrix4fv( gl.getUniformLocation(program, "u_projectionMatrix" ), false, flatten(projMatrix) );

    // for trackball
    canvas.addEventListener("mousedown", function(event){
        m_mousex = event.clientX - event.target.getBoundingClientRect().left;
        m_mousey = event.clientY - event.target.getBoundingClientRect().top;
        trackballMove = true;
    });

    // for trackball
    canvas.addEventListener("mouseup", function(event){
        trackballMove = false;
    });

    // for trackball
    canvas.addEventListener("mousemove", function(event){
      if (trackballMove) {
        var x = event.clientX - event.target.getBoundingClientRect().left;
        var y = event.clientY - event.target.getBoundingClientRect().top;
        mouseMotion(x, y);
      }
    } );

    // increase daysPerFrame
    document.getElementById("IncDPF").onclick = function () {
      daysPerFrame *= 2;
    };

    // decrease daysPerFrame
    document.getElementById("DecDPF").onclick = function () {
      daysPerFrame /= 2;
    };

    document.getElementById("RedSlider").onchange = function(event) {
      redRGB = parseFloat(event.target.value);
      alert(redRGB);
      lightSpecular = vec4( redRGB, greenRGB, blueRGB, 1.0 );
      alert(lightSpecular);
      lightDiffuse = lightSpecular;
    };

    document.getElementById("GreenSlider").onchange = function(event) {
      greenRGB = parseFloat(event.target.value);
      lightSpecular = vec4( redRGB, greenRGB, blueRGB, 1.0 );
      lightDiffuse = lightSpecular;
    };

    document.getElementById("BlueSlider").onchange = function(event) {
      blueRGB = parseFloat(event.target.value);
      lightSpecular = vec4( redRGB, greenRGB, blueRGB, 1.0 );
      lightDiffuse = lightSpecular;
    };


    gl.uniform4fv( gl.getUniformLocation( program, "u_lightPosition"), flatten(lightPosition) );
    gl.uniform1f(  gl.getUniformLocation( program, "u_shininess"), materialShininess );

    earthRotPerFrame = daysPerFrame * 360.0;

    render();

};

function setupCircle() {
    var increment = 0.1;
    for (var theta=0.0; theta < Math.PI*2; theta+=increment) {
        circleVertexPositionData.push(vec3(Math.cos(theta+increment), 0.0, Math.sin(theta+increment)));
    }
}

function setupSphere() {
    var latitudeBands = 50;
    var longitudeBands = 50;
    var radius = 1.0;

    // compute sampled vertex positions
    for (var latNumber=0; latNumber <= latitudeBands; latNumber++) {
        var theta = latNumber * Math.PI / latitudeBands;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        for (var longNumber=0; longNumber <= longitudeBands; longNumber++) {
            var phi = longNumber * 2 * Math.PI / longitudeBands;
            var sinPhi = Math.sin(phi);
            var cosPhi = Math.cos(phi);

            var x = cosPhi * sinTheta;
            var y = cosTheta;
            var z = sinPhi * sinTheta;

            sphereVertexPositionData.push(radius * x);
            sphereVertexPositionData.push(radius * y);
            sphereVertexPositionData.push(radius * z);


            // the normal of the triangle face, per face normals
            normalsArray.push(x);
            normalsArray.push(y);
            normalsArray.push(z);

            // textrue coordinates for each vertex
            var u = 1 - (longNumber / longitudeBands);
            var v = 1 - (latNumber / latitudeBands);
            textureCoordData.push(vec2(u,v));
        }
    }

    // create the actual mesh, each quad is represented by two triangles
    for (var latNumber=0; latNumber < latitudeBands; latNumber++) {
        for (var longNumber=0; longNumber < longitudeBands; longNumber++) {
            var first = (latNumber * (longitudeBands + 1)) + longNumber;
            var second = first + longitudeBands + 1;
            // the three vertices of the 1st triangle
            sphereVertexIndexData.push(first);
            sphereVertexIndexData.push(second);
            sphereVertexIndexData.push(first + 1);
            // the three vertices of the 2nd triangle
            sphereVertexIndexData.push(second);
            sphereVertexIndexData.push(second + 1);
            sphereVertexIndexData.push(first + 1);
        }
    }
}

function drawCircle(color, size) {
    // set uniforms
    gl.uniform3fv( u_colorLoc, color );

    var topm = stack[stack.length-1]; // get the matrix at the top of stack
    mvMatrix = mult(topm, scalem(size, size, size));

    mvMatrix = mult(commonMVMatrix, mvMatrix);
    gl.uniformMatrix4fv(u_mvMatrixLoc, false, flatten(mvMatrix) );

    gl.enableVertexAttribArray( a_positionLoc );
    gl.bindBuffer(gl.ARRAY_BUFFER, circleVertexPositionBuffer);
    gl.vertexAttribPointer( a_positionLoc, 3, gl.FLOAT, false, 0, 0 );
    gl.drawArrays( gl.LINE_LOOP, 0, circleVertexPositionData.length);
}

function drawSphere(color, size, texture) {
    // set uniforms
    gl.uniform3fv( u_colorLoc, color );

    ambientProduct = vec4(0.04, 0.04, 0.04, 1.0);
    diffuseProduct = mult(lightDiffuse, vec4(1.0, 1.0, 1.0, 1.0) );
    specularProduct = mult(lightSpecular, vec4(1.0, 1.0, 1.0, 1.0) );

    gl.uniform4fv( u_ambientProductLoc, flatten(ambientProduct) );
    gl.uniform4fv( u_diffuseProductLoc, flatten(diffuseProduct) );
    gl.uniform4fv( u_specularProductLoc, flatten(specularProduct) );

    var topm = stack[stack.length-1]; // get the matrix at the top of stack
    mvMatrix = mult(topm, scalem(size, size, size));

    mvMatrix = mult(commonMVMatrix, mvMatrix);
    gl.uniformMatrix4fv(u_mvMatrixLoc, false, flatten(mvMatrix) );


    var nMatrix = normalMatrix(mvMatrix, true);

    gl.uniformMatrix4fv(u_modelViewMatrixLoc, false, flatten(mvMatrix) );
    gl.uniformMatrix3fv(u_nMatrixLoc, false, flatten(nMatrix) );

    gl.enableVertexAttribArray( a_vNormalLoc );
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.vertexAttribPointer(a_vNormalLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.enableVertexAttribArray( a_TextureCoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
    gl.vertexAttribPointer(a_TextureCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray( a_positionLoc );
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
    gl.vertexAttribPointer(a_positionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereVertexIndexBuffer);
    gl.drawElements(gl.TRIANGLES, sphereVertexIndexData.length, gl.UNSIGNED_SHORT, 0);


}

function drawOrbits() {
    var gray = vec3( 1.0, 1.0, 1.0 );
    gl.uniform1i(u_useLightingLoc, false);

    // Mercury
    stack.push(mat4());
    drawCircle( gray, orMercury );
    stack.pop();

    // Venus
    stack.push(mat4());
    drawCircle( gray, orVenus );
    stack.pop();

    // Earth
    stack.push(mat4());
    drawCircle( gray, orEarth );
    stack.pop();
}

function drawBodies() {
    var size;
    var angleOffset = currentDay * 360.0;  // days * degrees
    gl.uniform1i(u_useLightingLoc, true);


    // Sun
    size = rSun * rSunMult;
    stack.push(mat4());
    drawSphere( vec3( 1.0, 1.0, 0.0 ), size, sunTexture );
    stack.pop();

    // Mercury
    size = rMercury * rPlanetMult;
    stack.push(mult(rotateY(angleOffset/pMercury), translate(orMercury, 0.0, 0.0)));
    drawSphere( vec3( 1.0, 0.5, 0.5 ), size, mercuryTexture );
    stack.pop();

    // Venus
    size = rVenus * rPlanetMult;
    stack.push(mult(rotateY(angleOffset/pVenus), translate(orVenus, 0.0, 0.0)));
    drawSphere( vec3( 0.5, 1.0, 0.5 ), size, venusTexture );
    stack.pop();

    // Earth and Moon
    size = rEarth * rPlanetMult;
    var mEarth = mult(mult(mult(rotateY(angleOffset/pEarth), translate(orEarth, 0.0, 0.0)),  rotateZ(23.5)), rotateY(earthRotate));
    stack.push(mEarth);
    drawSphere( vec3( 0.5, 0.5, 1.0 ), size, earthTexture );
    var orMoonNew = Math.max(orMoon, (rEarth+rMoon)*rPlanetMult);
    size = rMoon * rPlanetMult;
    var mMoon = mult(rotateY(angleOffset/pMoon), translate(orMoonNew, 0.0, 0.0));
    stack[stack.length-1] = mult(stack[stack.length-1], mMoon);
    drawSphere( vec3( 1.0, 1.0, 1.0 ), size, moonTexture );
    if (document.getElementById("orbon").checked == true){
      gl.uniform1i(u_useLightingLoc, false);
      stack.push(mEarth);
      drawCircle( vec3( 0.2, 0.2, 0.2 ), orMoonNew );
      stack.pop();
    }
    stack.pop();

}

function drawDay() {
    if (document.getElementById("dayon").checked == true){
      var string = 'Day ' + currentDay.toString();
      printDay.innerHTML = string;
    }
    else { printDay.innerHTML = '';}
}

function drawAll()
{
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // all planets and orbits will take the following transformation

    // global scaling
    commonMVMatrix = scalem(globalScale, globalScale, globalScale);

    commonMVMatrix = mult( rotateX(15), commonMVMatrix);

    // for trackball
    m_inc = build_rotmatrix(m_curquat);
    commonMVMatrix = mult(m_inc, commonMVMatrix);

    // viewing matrix
    commonMVMatrix = mult(lookAt(vec3(0.0, 0.0, 100.0),
                                  vec3(0.0, 0.0, 0.0),
                                  vec3(0.0, 1.0, 0.0)),
                           commonMVMatrix);


    if (document.getElementById("orbon").checked == true)
        drawOrbits();

    drawBodies();
    drawDay();
}

function handleLoadedTexture(texture) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  gl.generateMipmap(gl.TEXTURE_2D);
}

function initTexture() {
  // Sun
  sunTexture = gl.createTexture();
  sunTexture.image = new Image();
  sunTexture.image.onload = function() {
    handleLoadedTexture(sunTexture)
  }

  sunTexture.image.src = "sun.jpg";

  // Mercury
  mercuryTexture = gl.createTexture();
  mercuryTexture.image = new Image();
  mercuryTexture.image.onload = function() {
    handleLoadedTexture(mercuryTexture)
  }

  mercuryTexture.image.src = "mercury.jpg";

  // Venus
  venusTexture = gl.createTexture();
  venusTexture.image = new Image();
  venusTexture.image.onload = function() {
    handleLoadedTexture(venusTexture)
  }

  venusTexture.image.src = "venus.jpg";

  // Earth
  earthTexture = gl.createTexture();
  earthTexture.image = new Image();
  earthTexture.image.onload = function() {
    handleLoadedTexture(earthTexture)
  }

  earthTexture.image.src = "earth.jpg";

  // Moon
  moonTexture = gl.createTexture();
  moonTexture.image = new Image();
  moonTexture.image.onload = function() {
    handleLoadedTexture(moonTexture)
  }

  moonTexture.image.src = "moon.jpg";
}

var render = function() {
    // Calculate the elapsed time
    var now = Date.now(); // time in ms
    elapsed += now - g_last;
    g_last = now;
    if (elapsed >= mspf) {
        if (document.getElementById("animon").checked == true){
          currentDay += daysPerFrame;
          earthRotate += earthRotPerFrame;
        }
        elapsed = 0;
    }
    requestAnimFrame(render);
    drawAll();
};
