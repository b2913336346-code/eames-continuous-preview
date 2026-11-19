import * as T from './engine/three.min.js';

export const cameraPositions = {
  about: [3.8, 2.75, 7.9],
  growth: [2.8, 3.65, 8.3],
  career: [2.0, 3.4, 8.3],
  projects: [1.9, 2.7, 8.1],
  journal: [3.35, 4.2, 7.8],
  interests: [2.1, 3.45, 8.5],
  contact: [2.25, 3.1, 7.8],
};

const images = [
  { path: '/eames-continuous-preview/_astro/home.DgDaGkx2_uN4rr.webp', ratio: 1080 / 1920 },
  { path: '/eames-continuous-preview/_astro/club-admin-form.DqnBFpib_1zJ651.webp', ratio: 480 / 265 },
  { path: '/eames-continuous-preview/images/projects/crane/competition-work-02.jpg', ratio: 4 / 3 },
];

const palette = {
  ice: 0xbac4c9,
  mid: 0x78878e,
  ink: 0x35434c,
  blue: 0x588a9b,
  paper: 0xd6d3c7,
};

function roundedRect(width, height, radius, centerX = 0, centerY = 0) {
  const shape = new T.Shape();
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const bottom = centerY - height / 2;
  const top = centerY + height / 2;
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  return shape;
}

function extrusion(shape, depth, bevel, low) {
  const geometry = new T.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: low ? 1 : 2,
    curveSegments: low ? 4 : 8,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function setGlow(material, value) {
  material.emissive.setHex(palette.blue);
  material.emissiveIntensity = value;
}

export function buildComposition(name, { low = false, variant = 0, count = 0, signal } = {}) {
  const root = new T.Group();
  const resources = new Set();
  const loads = [];
  const segments = low ? 12 : 28;
  const material = (color, metalness = .25) => {
    const result = new T.MeshStandardMaterial({ color, metalness, roughness: .55 });
    resources.add(result);
    return result;
  };
  const ice = material(palette.ice);
  const mid = material(palette.mid);
  const ink = material(palette.ink);
  const blue = material(palette.blue);
  const paper = material(palette.paper, .02);
  const group = (parent = root) => {
    const result = new T.Group();
    parent.add(result);
    return result;
  };
  const mesh = (geometry, surface, parent = root, position = [0, 0, 0]) => {
    resources.add(geometry);
    const result = new T.Mesh(geometry, surface);
    result.position.set(...position);
    parent.add(result);
    return result;
  };
  const plate = (w, h, depth, radius, surface, parent, position) =>
    mesh(extrusion(roundedRect(w, h, radius), depth, Math.min(.035, radius / 2), low), surface, parent, position);
  const cylinder = (radius, height, surface, parent, position) =>
    mesh(new T.CylinderGeometry(radius, radius, height, segments), surface, parent, position);
  const sphere = (radius, surface, parent, position) =>
    mesh(new T.SphereGeometry(radius, segments, low ? 8 : 16), surface, parent, position);
  const path = (points, radius, surface) => {
    const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
    mesh(new T.TubeGeometry(curve, low ? 28 : 72, radius, low ? 5 : 9), surface);
    return curve;
  };
  const framedImage = (index, width, height, parent, z) => {
    const { path: url, ratio } = images[index];
    const screen = new T.MeshBasicMaterial({ color: 0x343d44, toneMapped: false });
    resources.add(screen);
    const fittedWidth = Math.min(width, height * ratio);
    const fittedHeight = Math.min(height, width / ratio);
    mesh(new T.PlaneGeometry(fittedWidth, fittedHeight), screen, parent, [0, 0, z]);
    loads.push(fetch(url, { signal }).then(response => {
      if (!response.ok) throw new Error('Project image unavailable');
      return response.blob();
    }).then(blob => createImageBitmap(blob, { imageOrientation: 'flipY' })).then(bitmap => {
      if (signal?.aborted) {
        bitmap.close();
        return;
      }
      const texture = new T.Texture(bitmap);
      texture.colorSpace = T.SRGBColorSpace;
      texture.needsUpdate = true;
      resources.add(texture);
      screen.map = texture;
      screen.color.setHex(0xffffff);
      screen.needsUpdate = true;
    }).catch(() => {
      // The frame remains geometry when its existing image is unavailable.
    }));
  };

  let update;

  switch (name) {
    case 'about': {
      const assembly = group();
      const shoulders = plate(3.22, .57, 1.0, .16, ink, assembly, [0, -1.08, 0]);
      shoulders.rotation.x = -.15;
      plate(1.24, .41, .83, .11, mid, assembly, [0, -.7, .03]);
      const planes = [
        [-.57, .03, 0, 1.03, 1.6, .89, .12, ice, -.11],
        [.55, .21, -.03, .93, 1.58, .72, .10, mid, .12],
        [-.27, .96, .06, 1.47, .34, 1.03, .09, paper, -.07],
        [.43, .58, .57, .67, .46, .28, .08, blue, .12],
        [-.56, -.21, .59, .87, .39, .28, .08, ink, -.08],
      ].map(([x, y, z, w, h, d, r, surface, tilt]) => {
        const slab = plate(w, h, d, r, surface, assembly, [x, y, z]);
        slab.rotation.z = tilt;
        return { slab, y };
      });
      update = ({ engagement }) => {
        planes[2].slab.position.y = planes[2].y + .14 * engagement;
        planes[3].slab.position.y = planes[3].y + .08 * engagement;
      };
      break;
    }
    case 'growth': {
      const steps = Math.max(1, count);
      const lights = [];
      const spacing = 4.35 / Math.max(steps - 1, 1);
      for (let i = 0; i < steps; i++) {
        const foot = -1.2;
        const rise = .29 + i * .42;
        const x = (i - (steps - 1) / 2) * spacing;
        const z = (i - (steps - 1) / 2) * -.15;
        plate(.73, rise, 1.08, .06, i % 2 ? mid : ice, root, [x, foot + rise / 2, z]);
        plate(.75, .085, 1.1, .045, ink, root, [x, foot + rise - .005, z]);
        const lamp = material(palette.blue);
        lights.push(lamp);
        cylinder(.075, .055, lamp, root, [x, foot + rise + .069, z + .28]);
      }
      update = ({ reading }) => lights.forEach((lamp, index) => {
        setGlow(lamp, index <= Math.max(0, reading) ? .53 : .02);
      });
      break;
    }
    case 'career': {
      const rail = path([
        [-2.37, -1.03, .34], [-1.82, -.76, .45], [-1.15, -.13, .25],
        [-.47, -.25, -.23], [.23, .30, -.39], [.94, .81, -.27], [2.28, .57, -.48],
      ], .039, mid);
      const pins = [.23, .8].map(value => {
        const { x, y, z } = rail.getPointAt(value);
        const mount = group();
        mount.position.set(x, y, z);
        cylinder(.19, .085, ink, mount, [0, .02, 0]);
        cylinder(.085, .29, ice, mount, [0, .17, 0]);
        const glowing = material(palette.blue);
        const head = sphere(.133, glowing, mount, [0, .34, 0]);
        return { head, glowing };
      });
      update = ({ focus, reading }) => pins.forEach(({ head, glowing }, index) => {
        const active = index === (focus >= 0 ? focus : reading);
        setGlow(glowing, active ? .65 : .1);
        head.scale.setScalar(active ? 1.15 : 1);
      });
      break;
    }
    case 'projects': {
      const exhibits = [
        { x: -1.52, y: -.13, z: .12, turn: .12, w: .84, h: 1.53, d: .14, radius: .115, surface: ink },
        { x: -.03, y: -.34, z: -.23, turn: -.05, w: 1.91, h: 1.12, d: .16, radius: .075, surface: mid },
        { x: 1.63, y: -.16, z: -.34, turn: -.23, w: 1.64, h: 1.45, d: .22, radius: .065, surface: ice },
      ].map(({ x, y, z, turn, w, h, d, radius, surface }, index) => {
        const stand = group();
        stand.position.set(x, -1.02, z);
        plate(index === 0 ? 1.23 : 1.54, .20, 1.14, .085, surface, stand, [0, -.09, .04]);
        const display = group(stand);
        display.position.y = 1.22 + y;
        display.rotation.y = turn;
        plate(w, h, d, radius, surface, display);
        plate(w - .12, h - .12, .025, radius / 2, ink, display, [0, 0, d / 2 + .006]);
        framedImage(index, w - .15, h - .15, display, d / 2 + .069);
        return { display, turn };
      });
      update = ({ focus, engagement }) => exhibits.forEach(({ display, turn }, index) => {
        const active = index === (focus >= 0 ? focus : variant);
        display.rotation.y = turn + (active ? engagement * .13 : 0);
      });
      break;
    }
    case 'journal': {
      const books = [
        [-1.77, -.23, -.68, .43, 1.96, ice, -.18],
        [-1.23, -.32, -.78, .39, 1.77, ink, -.04],
        [-.78, -.08, -.95, .37, 2.07, blue, .09],
      ];
      books.forEach(([x, y, z, w, h, surface, angle]) => {
        const spine = plate(w, h, .73, .075, surface, root, [x, y, z]);
        spine.rotation.z = angle;
        const edge = plate(w * .72, h * .88, .05, .035, paper, root, [x, y, z + .39]);
        edge.rotation.z = angle;
      });
      const opened = group();
      opened.position.set(.75, -.65, .47);
      opened.rotation.set(-.93, 0, -.21);
      plate(2.76, 1.82, .12, .115, ink, opened, [0, 0, -.095]);
      const left = plate(1.27, 1.61, .072, .085, paper, opened, [-.65, 0, 0]);
      left.rotation.y = -.14;
      plate(1.27, 1.61, .072, .085, paper, opened, [.65, 0, 0]).rotation.y = .12;
      const hinge = group(opened);
      hinge.position.z = .075;
      plate(1.23, 1.56, .027, .08, ice, hinge, [.62, 0, 0]);
      update = ({ focus, engagement }) => {
        hinge.rotation.y = .11 + (focus >= 0 || variant > 0 ? .04 : 0) + .16 * engagement;
      };
      break;
    }
    case 'interests': {
      const controller = group();
      controller.position.set(-1.4, .12, .26);
      const outline = new T.Shape();
      outline.moveTo(-.74, .36);
      outline.quadraticCurveTo(-1.00, .35, -1.14, -.35);
      outline.quadraticCurveTo(-1.25, -.91, -.77, -.66);
      outline.lineTo(-.44, -.41);
      outline.lineTo(.44, -.41);
      outline.lineTo(.77, -.66);
      outline.quadraticCurveTo(1.25, -.91, 1.14, -.35);
      outline.quadraticCurveTo(1.00, .35, .74, .36);
      outline.closePath();
      mesh(extrusion(outline, .25, .058, low), ink, controller);
      for (const [x, y, radius] of [[-.45, -.08, .14], [.05, -.25, .12], [.57, .01, .059], [.69, .12, .059], [.56, .23, .059]]) {
        const button = cylinder(radius, .08, x > .35 ? blue : ice, controller, [x, y, .18]);
        button.rotation.x = Math.PI / 2;
      }
      const ticket = group();
      ticket.position.set(.46, -.46, .75);
      const receipt = new T.Shape();
      receipt.moveTo(-.53, -.7);
      receipt.lineTo(.53, -.7);
      receipt.lineTo(.53, -.12);
      receipt.quadraticCurveTo(.27, 0, .53, .12);
      receipt.lineTo(.53, .7);
      receipt.lineTo(-.53, .7);
      receipt.lineTo(-.53, .12);
      receipt.quadraticCurveTo(-.27, 0, -.53, -.12);
      receipt.closePath();
      mesh(extrusion(receipt, .09, .025, low), paper, ticket);
      plate(.45, .085, .028, .025, mid, ticket, [0, -.29, .07]);
      const film = group();
      film.position.set(1.38, .42, -.38);
      const strip = roundedRect(1.66, 1.31, .09);
      strip.holes.push(roundedRect(1.08, .75, .065));
      for (const side of [-1, 1]) {
        for (let i = -1; i <= 1; i++) {
          strip.holes.push(roundedRect(.12, .16, .023, side * .67, i * .31));
        }
      }
      mesh(extrusion(strip, .15, .023, low), blue, film);
      const objects = [controller, ticket, film];
      update = ({ focus, engagement }) => objects.forEach((object, i) => {
        object.rotation.set(i === 1 ? -.32 : -.10, (i - 1) * -.22 + (i === focus ? .17 * engagement : 0), [-.18, -.42, .19][i]);
      });
      break;
    }
    case 'contact': {
      const track = path([
        [-2.12, .55, .43], [-1.72, .59, .12], [-.89, -.44, -.48],
        [-.08, -.89, -.1], [.79, -.42, .41], [1.40, .35, .28], [2.07, .57, -.12],
      ], .077, ice);
      const ports = [0, 1].map((value, index) => {
        const { x, y, z } = track.getPointAt(value);
        const port = group();
        port.position.set(x, y, z);
        port.rotation.set(-.3, index ? .25 : -.3, index ? -.21 : .25);
        plate(.69, .68, .40, .18, ink, port);
        const surface = material(palette.blue);
        const contact = cylinder(.165, .075, surface, port, [0, 0, .25]);
        contact.rotation.x = Math.PI / 2;
        return { contact, surface };
      });
      update = ({ focus, engagement }) => ports.forEach(({ contact, surface }, index) => {
        const active = focus === index;
        contact.position.z = .25 + (active ? .08 * engagement : 0);
        setGlow(surface, .13 + (active ? .51 * engagement : 0));
      });
      break;
    }
    default:
      throw new Error('Unknown spatial composition');
  }

  update({ scroll: 0, engagement: 0, focus: -1, reading: -1 });
  const bounds = new T.Box3().setFromObject(root);
  const center = bounds.getCenter(new T.Vector3());
  const pivot = new T.Group();
  root.position.sub(center);
  pivot.add(root);

  return {
    pivot,
    update,
    ready: Promise.all(loads),
    dispose() {
      for (const resource of resources) {
        if (resource.isTexture) resource.image?.close();
        resource.dispose();
      }
      resources.clear();
    },
  };
}
