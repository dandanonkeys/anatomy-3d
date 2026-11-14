// Named groups of structures that lab lists treat as one item (a lobe, a muscle
// group, a set of nerves). Members are matched on structure names with the
// side removed. Selecting a group highlights every member on both sides.

export const GROUPS = [
  // Brain: lobes as sets of gyri (Z-Anatomy has no single lobe meshes).
  { name: 'Frontal lobe', system: 'nervous', match: /^(superior|middle) frontal gyrus|inferior frontal gyrus|^precentral gyrus|^orbital gyri|straight gyrus|frontopolar|^paracentral gyrus/i },
  { name: 'Parietal lobe', system: 'nervous', match: /^postcentral gyrus|supramarginal gyrus|angular gyrus|superior parietal lobule|^precuneus/i },
  { name: 'Temporal lobe', system: 'nervous', match: /temporal gyr|temporal pole|occipitotemporal gyrus/i },
  { name: 'Occipital lobe', system: 'nervous', match: /occipital gyr|^cuneus|lingual gyrus|occipital pole/i },
  { name: 'Cerebrum (cerebral hemispheres)', system: 'nervous', match: /gyr|lobule|^cuneus|^precuneus|pole$|^insula/i, exclude: /cerebell|semilunar|quadrangular|biventral|gracile|central lobule/i },
  { name: 'Diencephalon', system: 'nervous', match: /^thalamus|hypothalamus|habenula|stria medullaris thalami|pineal gland/i },
  { name: 'Brainstem', system: 'nervous', match: /^midbrain|^pons|medulla oblongata|colliculus|base of peduncle/i },
  { name: 'Cerebellum', system: 'nervous', match: /vermis|cerebell|semilunar lobule|quadrangular lobule|biventral lobule|gracile lobule|^central lobule|flocculus|lingula of cerebellum|tonsil of cerebellum/i },
  { name: 'Brachial plexus terminal nerves', system: 'nervous', match: /^(musculocutaneous|axillary|radial|median|ulnar) nerve$/i },
  { name: 'Gray matter of spinal cord', system: 'nervous', match: /horn of spinal cord/i },
  { name: 'Dura mater (spinal dura only)', system: 'nervous', match: /^spinal dura$/i },
  { name: 'Pituitary gland (hypophysis)', system: 'endocrine', match: /^(adenohypophysis|neurohypophysis)$/i },
  { name: 'Spinal cord', system: 'nervous', match: /horn of spinal cord|white matter of spinal cord|spinal tract|corticospinal|spinothalamic|spinocerebellar|reticulospinal|vestibulospinal|rubrospinal|tectospinal|spinotectal|posterolateral tract/i },

  // Muscle groups named on the lab lists.
  { name: 'Rotator cuff', system: 'muscular', match: /^(supraspinatus|infraspinatus|teres minor|subscapularis)( muscle)?$/i },
  { name: 'Rhomboids', system: 'muscular', match: /^rhomboid (major|minor)/i },
  { name: 'Erector spinae', system: 'muscular', match: /^(iliocostalis|longissimus|spinalis) /i },
  { name: 'Iliopsoas', system: 'muscular', match: /^(psoas major|iliacus)( muscle)?$/i },
  { name: 'Quadriceps femoris', system: 'muscular', match: /^(rectus femoris|vastus lateralis|vastus medialis|vastus intermedius)( muscle)?$/i },
  { name: 'Hamstrings', system: 'muscular', match: /biceps femoris|^semitendinosus|^semimembranosus/i },
  { name: 'Adductors of the thigh', system: 'muscular', match: /^adductor (longus|brevis|magnus|minimus)|^gracilis|^pectineus/i },
  { name: 'Lateral rotators of the hip', system: 'muscular', match: /^piriformis|^obturator (internus|externus)|gemellus|quadratus femoris/i },
  { name: 'Gluteal muscles', system: 'muscular', match: /^gluteus (maximus|medius|minimus)/i },
  { name: 'Flexors of the wrist and digits', system: 'muscular', match: /flexor carpi|flexor digitorum (superficialis|profundus)|flexor pollicis longus|palmaris longus/i },
  { name: 'Extensors of the wrist and digits', system: 'muscular', match: /extensor carpi|^extensor digitorum( muscle)?$|extensor digiti minimi|extensor indicis|extensor pollicis/i },
  { name: 'Fibularis (peroneus) muscles', system: 'muscular', match: /^fibularis (longus|brevis|tertius)/i },
  { name: 'Triceps surae (calf)', system: 'muscular', match: /gastrocnemius|^soleus/i },
  { name: 'Biceps brachii', system: 'muscular', match: /head of biceps brachii|^biceps brachii/i },
  { name: 'Triceps brachii', system: 'muscular', match: /head of triceps brachii|^triceps brachii/i },
  { name: 'Abdominal wall muscles', system: 'muscular', match: /^(rectus abdominis|external (abdominal )?oblique|internal (abdominal )?oblique|transversus abdominis)/i },
];

export const stripSide = (name) => name.replace(/^(left|right)\s+/i, '').replace(/^./, (c) => c.toUpperCase());
