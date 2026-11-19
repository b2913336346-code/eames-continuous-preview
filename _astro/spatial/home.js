import * as T from './engine/three.min.js';
import { adaptBeats, chapterDetails, decodePlate, fitPlate } from './continuous-beats.js';

const plates = [
  [1.15, 2.05, .044, '/eames-continuous-preview/images/projects/yingji/home-screen.webp'],
  [2.15, 1.28, .046, '/eames-continuous-preview/images/projects/club/admin-screen.webp'],
  [2.05, 1.36, .05, '/eames-continuous-preview/images/projects/crane/competition-work-02.jpg'],
];

// Position within the viewport, overall scale, and the strength of the faces and outlines.
const { beats, workBeat } = adaptBeats([
  { anchor: [.253, -.065], scale: 1.03, face: 1, line: .82, poses: [
    [1.04, .43, .24, -.51, .45], [-.68, .82, .04, -.51, .45], [-.49, -.59, -.16, -.51, .45],
  ] },
  { anchor: [.248, -.115], scale: .88, face: .18, line: .52, poses: [
    [.98, .54, -.17, -.55, .37], [-.71, .9, -.38, -.59, .38], [-.44, -.51, -.63, -.53, .51],
  ] },
  { anchor: [.244, -.04], scale: .94, face: 1, line: .86, poses: [
    [1.05, .28, .29, -.46, .43], [-.67, .79, .08, -.41, .42], [-.57, -.62, -.12, -.43, .46],
  ] },
  { anchor: [-.24, -.23], scale: .86, face: .21, line: .62, poses: [
    [-1.24, -.64, .63, -.76, .39], [-.07, -.10, .06, -.78, .45], [.96, .58, -.61, -.82, .51],
  ] },
  { anchor: [.09, .09], scale: .93, face: .018, line: .58, poses: [
    [1.78, .27, .1, -.41, .53], [-1.57, .41, -.43, -.48, -.52], [-.12, -.52, .43, -.6, .29],
  ] },
  { anchor: [.25, .005], scale: .42, face: .12, line: .66, poses: [
    [.18, .22, .24, -.49, .55], [-.26, .01, .01, -.49, .55], [-.53, -.24, -.24, -.49, .55],
  ] },
]);

function rectangle(width, height) {
  const x = width / 2;
  const y = height / 2;
  const shape = new T.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  return shape;
}

function sheet(shape, depth) {
  return new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

function setOpacity(mesh, opacity) {
  mesh.visible = opacity > .007;
  mesh.material.opacity = opacity;
  mesh.material.depthWrite = opacity > .985;
}

function focusPose(base, work, target) {
  if (work === target) {
    return [-.40, .03, base[2] + 1.96, -.035, .045];
  }
  const [x, y, z] = base;
  return [x + (work === 0 ? .34 : -.35), y + (work === 1 ? .14 : -.11), z - .92, -.58, .49];
}

export function buildHomeComposition({ signal, assetBase = '' } = {}) {
  const pivot = new T.Group();
  const resources = new Set();
  let disposed = false;

  function add(parent, geometry, material, z = 0) {
    resources.add(geometry).add(material);
    const mesh = new T.Mesh(geometry, material);
    mesh.position.z = z;
    parent.add(mesh);
    return mesh;
  }

  const panels = plates.map((plate, index) => {
    const [width, height, depth, path] = fitPlate(plate, index);
    const group = new T.Group();
    pivot.add(group);
    const solid = add(group, sheet(rectangle(width, height), depth),
      new T.MeshStandardMaterial({ roughness: .72, metalness: .16, transparent: true }));
    const border = rectangle(width + .003, height + .003);
    border.holes.push(rectangle(width - .008, height - .008));
    const outline = add(group, sheet(border, depth + .006),
      new T.MeshBasicMaterial({ toneMapped: false, transparent: true }));
    let face;
    const ready = fetch(assetBase + path, { signal }).then(response => {
      if (!response.ok) throw new Error('Exhibit image unavailable');
      return response.blob();
    }).then(blob => decodePlate(blob)).then(bitmap => {
      if (disposed || signal?.aborted) {
        bitmap.close?.();
        return;
      }
      const texture = new T.Texture(bitmap);
      texture.colorSpace = T.SRGBColorSpace;
      texture.needsUpdate = true;
      resources.add(texture);
      face = add(group, new T.PlaneGeometry(width, height),
        new T.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true }), depth / 2 + .006);
    });
    return { group, solid, outline, get face() { return face; }, ready };
  });

  const drawDetails = chapterDetails(T, pivot, resources);
  let activeTheme;
  const lerp = T.MathUtils.lerp;
  return {
    pivot,
    ready: Promise.all(panels.map(panel => panel.ready)),
    update({ scroll, x, y, work01, work02, work03, width, height, palette, mobileY, mobileFade, poster = false }) {
      const current = Math.min(beats.length - 1, Math.max(0, scroll));
      const start = Math.floor(current);
      const first = beats[start];
      const second = beats[Math.min(start + 1, beats.length - 1)];
      const t = current - start;
      const mix = t * t * (3 - 2 * t);
      const focus = [work01, work02, work03];
      const focusTotal = Math.min(1, work01 + work02 + work03);
      const spanY = 2 * 8.6 * Math.tan(T.MathUtils.degToRad(16));
      const spanX = spanY * width / height;
      const margin = 1.38;
      const anchorX = lerp(lerp(first.anchor[0], second.anchor[0], mix), workBeat.anchor[0], focusTotal) * spanX;
      const anchorY = lerp(lerp(first.anchor[1], second.anchor[1], mix), workBeat.anchor[1], focusTotal) * spanY;

      const narrow = !poster && width <= 900;
      const responsiveScale = narrow ? Math.min(.82, spanX / 4.6) : 1;
      const offset = Math.max(0, spanX / 2 - margin);
      const centerX = narrow ? 0 : T.MathUtils.clamp(anchorX, -offset, offset);
      const centerY = narrow ? mobileY * spanY : anchorY;
      const drift = poster ? 0 : Math.sin(current * Math.PI);
      pivot.position.set(poster ? 0 : centerX, poster ? 0 : centerY, 0);
      pivot.scale.setScalar(lerp(lerp(first.scale, second.scale, mix), workBeat.scale, focusTotal) * responsiveScale);
      pivot.rotation.set(y * .145 + drift * .12, x * .155 + drift * .24, drift * .05);
      const sceneVisibility = narrow ? mobileFade : 1;
      const faceOpacity = lerp(first.face, second.face, mix);
      const lineOpacity = lerp(first.line, second.line, mix);

      panels.forEach(({ group, solid, outline, face }, i) => {
        const base = first.poses[i].map((value, axis) => lerp(value, second.poses[i][axis], mix));
        const position = [...base];
        focus.forEach((amount, target) => {
          if (amount < .001) return;
          const pose = focusPose(workBeat.poses[i], i, target);
          pose.forEach((value, axis) => { position[axis] += (value - base[axis]) * amount; });
        });
        group.position.set(position[0], position[1], position[2]);
        group.rotation.set(position[3], position[4], position[5] ?? 0);
        group.scale.setScalar(1 + .04 * focus[i]);
        const faceStrength = (lerp(faceOpacity, .76, focusTotal) + .24 * focus[i]) * sceneVisibility;
        setOpacity(solid, faceStrength * .95);
        setOpacity(outline, lineOpacity * sceneVisibility * (1 - T.MathUtils.smoothstep(faceStrength, .20, .73)));
        if (face) setOpacity(face, faceStrength);
        if (palette !== activeTheme) {
          solid.material.color.set(palette.metal);
          outline.material.color.set(palette.edge);
        }
      });
      drawDetails(first, second, mix, palette.edge, sceneVisibility);
      activeTheme = palette;
    },
    dispose() {
      disposed = true;
      for (const resource of resources) {
        if (resource.isTexture) resource.image.close?.();
        resource.dispose();
      }
      resources.clear();
    },
  };
}
