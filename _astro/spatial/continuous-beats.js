// Keep the six existing beats. Career and journal insert two poses into the same exhibit.
const career = {
  anchor: [.235, -.03], scale: .88, face: .13, line: .61,
  poses: [
    [-1.30, -.42, .47, -.40, .56, -.43],
    [.06, .58, -.17, -.52, .39, .08],
    [1.29, -.15, .17, -.40, -.46, .31],
  ],
};
const journal = {
  anchor: [.24, -.07], scale: .88, face: .13, line: .72,
  poses: [
    [.02, -.05, .20, -.26, 1.19, -.07],
    [-.82, .04, -.08, -.41, -.31, -.09],
    [.87, -.10, -.16, -.41, .37, -.045],
  ],
};

function withRoll(beat) {
  return { ...beat, poses: beat.poses.map(pose => [...pose, 0]) };
}

export function adaptBeats(base) {
  const [opening, about, work, growth, interests, contact] = base.map(withRoll);
  return { beats: [opening, about, growth, career, work, journal, interests, contact], workBeat: work };
}

const mediaRatios = [960 / 1707, 1600 / 881, 612 / 459];

export function fitPlate([width, height, depth, path], index) {
  const ratio = mediaRatios[index];
  const fittedWidth = Math.min(width, height * ratio);
  return [fittedWidth, fittedWidth / ratio, Math.min(depth, .013), path];
}

export function chapterDetails(T, parent, resources) {
  const path = new T.CatmullRomCurve3([
    [-2.2, -.81, .65], ...career.poses.map(pose => pose.slice(0, 3)), [2.18, -.62, .46],
  ].map(point => new T.Vector3(...point)));
  const curve = new T.TubeGeometry(path, 36, .016, 5);
  const spine = new T.CylinderGeometry(.022, .022, 2.14, 6);
  const guides = [{ geometry: curve, chapter: career, opacity: .63 },
    { geometry: spine, chapter: journal, opacity: .72 }];
  const meshes = guides.map(({ geometry }) => {
    const material = new T.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    const mesh = new T.Mesh(geometry, material);
    mesh.visible = false;
    parent.add(mesh);
    resources.add(geometry).add(material);
    return mesh;
  });
  meshes[1].position.set(.02, -.05, .29);
  meshes[1].rotation.set(-.25, 0, -.07);

  return function update(first, second, mix, edge) {
    guides.forEach(({ chapter, opacity }, index) => {
      const weight = (first === chapter ? 1 - mix : 0) + (second === chapter ? mix : 0);
      const mesh = meshes[index];
      mesh.visible = weight > .015;
      mesh.material.color.set(edge);
      mesh.material.opacity = opacity * weight;
    });
  };
}
