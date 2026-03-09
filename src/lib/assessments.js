export const C = {
  bg:"#FFFFFF", panel:"#F8F9FA", card:"#FFFFFF", border:"#E2E8F0",
  accent:"#2BAADF", accentDim:"#2BAADF12",
  red:"#EF4444", orange:"#F59E0B", teal:"#2BAADF",
  indigo:"#4F46E5", sky:"#0EA5E9", lime:"#059669",
  text:"#1A202C", sub:"#718096", faint:"#EDF2F7", green:"#059669",
}

export const ALL_ASSESSMENTS = {
  hypermobility: {
    id:"hypermobility", name:"Hypermobility Assessment", icon:"🤸",
    color:C.indigo, colorDim:C.indigo+"12",
    sections:[
      { id:"hm1", title:"Beighton Score Tests", fields:[
        { id:"hm_little_right", label:"Little finger hyperextension — Right (>90°)", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_little_left", label:"Little finger hyperextension — Left (>90°)", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_thumb_right", label:"Thumb to forearm — Right", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_thumb_left", label:"Thumb to forearm — Left", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_elbow_right", label:"Hyperextended elbows — Right (>10°)", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_elbow_left", label:"Hyperextended elbows — Left (>10°)", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_knee_right", label:"Hyperextended knees — Right (>10°)", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_knee_left", label:"Hyperextended knees — Left (>10°)", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_palms", label:"Palms flat to floor (knees straight)", type:"passfail", options:["Pass","Fail"] },
        { id:"hm_score", label:"Beighton Score (0–9)", type:"scale", min:0, max:9 },
        { id:"hm_notes", label:"Notes", type:"textarea" },
      ]}
    ]
  },
  prime8: {
    id:"prime8", name:"Prime 8 Full Body", icon:"🧠",
    color:C.accent, colorDim:C.accent+"12",
    sections:[
      { id:"p8s1", title:"8 Tests", fields:[
        { id:"p8_pain_move", label:"Personal Pain Move — describe movement and pain location", type:"textarea" },
        { id:"p8_duck_right", label:"Duck Foot Test — Right (feet turn out >15°)", type:"passfail", options:["Pass","Fail Right"] },
        { id:"p8_duck_left", label:"Duck Foot Test — Left", type:"passfail", options:["Pass","Fail Left"] },
        { id:"p8_pigeon_right", label:"Pigeon Foot Test — Right (feet turn in)", type:"passfail", options:["Pass","Fail Right"] },
        { id:"p8_pigeon_left", label:"Pigeon Foot Test — Left", type:"passfail", options:["Pass","Fail Left"] },
        { id:"p8_gas_right", label:"Gas Pedal Test — Right ankle (dorsiflexion <10°)", type:"passfail", options:["Pass","Fail Right"] },
        { id:"p8_gas_left", label:"Gas Pedal Test — Left ankle", type:"passfail", options:["Pass","Fail Left"] },
        { id:"p8_hip_swing", label:"Hip Swing Test — any restriction or pain", type:"passfail", options:["Pass","Fail"] },
        { id:"p8_hip_swing_side", label:"Hip Swing — which side restricted", type:"text" },
        { id:"p8_kneecap", label:"Knee Cap Grind Test — crepitus or pain", type:"passfail", options:["Pass","Fail"] },
        { id:"p8_kneecap_side", label:"Knee Cap Grind — which side", type:"text" },
        { id:"p8_empty_can", label:"Empty Can Test — shoulder weakness or pain", type:"passfail", options:["Pass","Fail"] },
        { id:"p8_empty_can_side", label:"Empty Can — which side", type:"text" },
        { id:"p8_neck_rotation", label:"Neck Rotation Test — restricted or painful", type:"passfail", options:["Pass","Fail"] },
        { id:"p8_neck_side", label:"Neck Rotation — which side restricted", type:"text" },
        { id:"p8_notes", label:"Additional notes / observations", type:"textarea" },
      ]}
    ]
  },
  neck: {
    id:"neck", name:"Neck & Shoulder Gauntlet", icon:"💪",
    color:C.sky, colorDim:C.sky+"12",
    sections:[
      { id:"ns1", title:"6 Tests", fields:[
        { id:"ns_pain_move", label:"Personal Pain Movement — describe", type:"textarea" },
        { id:"ns_hip_swing", label:"Hip Swing (Neck Influence) — does neck position change hip swing?", type:"passfail", options:["No change","Yes — neck affects swing"] },
        { id:"ns_trex", label:"T-Rex Wrist Extensor — wrist weakness with elbow bent", type:"passfail", options:["Pass","Fail"] },
        { id:"ns_trex_side", label:"T-Rex — which side", type:"text" },
        { id:"ns_full_can", label:"Full Can Side Raise — pain or weakness at 90° abduction", type:"passfail", options:["Pass","Fail"] },
        { id:"ns_full_can_side", label:"Full Can — which side", type:"text" },
        { id:"ns_empty_can", label:"Empty Can Test — supraspinatus weakness", type:"passfail", options:["Pass","Fail"] },
        { id:"ns_empty_can_side", label:"Empty Can — which side", type:"text" },
        { id:"ns_mental_stress", label:"Mental Stress Connection — symptoms worsen with stress", type:"passfail", options:["No","Yes"] },
        { id:"ns_notes", label:"Notes / referral flags", type:"textarea" },
      ]}
    ]
  },
  hip: {
    id:"hip", name:"Hip Posture Assessment", icon:"🦴",
    color:C.orange, colorDim:C.orange+"12",
    sections:[
      { id:"h1", title:"Lateral & Forward Hip Tilt", fields:[
        { id:"h_lateral_tilt", label:"Lateral Hip Tilt — which side drops", type:"text", placeholder:"e.g. Left hip drops, right iliac crest higher" },
        { id:"h_lateral_score", label:"Lateral Tilt Severity (1–10)", type:"scale", min:1, max:10 },
        { id:"h_forward_tilt", label:"Forward Hip Tilt — anterior or posterior pelvic tilt", type:"text" },
        { id:"h_forward_score", label:"Forward Tilt Severity (1–10)", type:"scale", min:1, max:10 },
      ]},
      { id:"h2", title:"Hip Rotation", fields:[
        { id:"h_rotation", label:"Standing Hip Rotation — any restriction", type:"passfail", options:["Pass","Fail"] },
        { id:"h_rotation_notes", label:"Rotation notes", type:"textarea" },
      ]},
      { id:"h3", title:"Prone Internal/External Rotation", fields:[
        { id:"h_internal_right", label:"Internal Rotation — Right (normal 40–50°)", type:"passfail", options:["Pass","Fail Right"] },
        { id:"h_internal_left", label:"Internal Rotation — Left", type:"passfail", options:["Pass","Fail Left"] },
        { id:"h_external_right", label:"External Rotation — Right (normal 40–60°)", type:"passfail", options:["Pass","Fail Right"] },
        { id:"h_external_left", label:"External Rotation — Left", type:"passfail", options:["Pass","Fail Left"] },
      ]},
      { id:"h4", title:"FABER & Hip Swing", fields:[
        { id:"h_faber_right", label:"FABER Test — Right (hip/SI joint)", type:"passfail", options:["Pass","Fail Right"] },
        { id:"h_faber_left", label:"FABER Test — Left", type:"passfail", options:["Pass","Fail Left"] },
        { id:"h_swing", label:"Hip Swing with modifiers — restriction side", type:"text" },
        { id:"h_swing_notes", label:"Hip swing modifier notes", type:"textarea" },
      ]},
      { id:"h5", title:"Flexibility", fields:[
        { id:"h_quad_right", label:"Quad flexibility — Right", type:"passfail", options:["Pass","Tight"] },
        { id:"h_quad_left", label:"Quad flexibility — Left", type:"passfail", options:["Pass","Tight"] },
        { id:"h_hamstring_right", label:"Hamstring flexibility — Right", type:"passfail", options:["Pass","Tight"] },
        { id:"h_hamstring_left", label:"Hamstring flexibility — Left", type:"passfail", options:["Pass","Tight"] },
        { id:"h_notes", label:"Overall hip notes", type:"textarea" },
      ]},
    ]
  },
  knee: {
    id:"knee", name:"Knee Posture Assessment", icon:"🦵",
    color:C.red, colorDim:C.red+"12",
    sections:[
      { id:"k1", title:"Alignment & Structure", fields:[
        { id:"k_thigh_right", label:"Thigh Girth — Right (cm)", type:"text" },
        { id:"k_thigh_left", label:"Thigh Girth — Left (cm)", type:"text" },
        { id:"k_height", label:"Knee Cap Height — normal / alta / baja", type:"text" },
        { id:"k_alignment", label:"Bow-legged (varus) or Knock-kneed (valgus)", type:"text" },
        { id:"k_bakers", label:"Baker's Cyst — present", type:"passfail", options:["No","Yes"] },
      ]},
      { id:"k2", title:"Range of Motion", fields:[
        { id:"k_hyperext", label:"Hyperextension present", type:"passfail", options:["No","Yes"] },
        { id:"k_flexion", label:"Full flexion achieved", type:"passfail", options:["Yes","No"] },
        { id:"k_flexion_notes", label:"Flexion restriction notes", type:"textarea" },
      ]},
      { id:"k3", title:"Patella & Joint Line", fields:[
        { id:"k_patella_press", label:"Patella Press — pain on compression", type:"passfail", options:["Pass","Fail"] },
        { id:"k_patella_side", label:"Patella Press — which side", type:"text" },
        { id:"k_joint_line_medial", label:"Medial Joint Line Compression — pain", type:"passfail", options:["Pass","Fail"] },
        { id:"k_joint_line_lateral", label:"Lateral Joint Line Compression — pain", type:"passfail", options:["Pass","Fail"] },
      ]},
      { id:"k4", title:"Meniscus", fields:[
        { id:"k_meniscus_survey", label:"Meniscus Survey — any catching/locking", type:"passfail", options:["Pass","Fail"] },
        { id:"k_salsa", label:"Salsa Test — meniscus provocation", type:"passfail", options:["Pass","Fail"] },
        { id:"k_notes", label:"Knee notes", type:"textarea" },
      ]},
    ]
  },
  foot: {
    id:"foot", name:"Foot & Ankle Assessment", icon:"🦶",
    color:C.lime, colorDim:C.lime+"12",
    sections:[
      { id:"f1", title:"Toe & Forefoot", fields:[
        { id:"f_toenails", label:"Toenail/fungus issues", type:"passfail", options:["Clear","Issues present"] },
        { id:"f_bunion_right", label:"Bunion — Right", type:"passfail", options:["None","Present"] },
        { id:"f_bunion_left", label:"Bunion — Left", type:"passfail", options:["None","Present"] },
        { id:"f_mortons_right", label:"Morton's Toe — Right (2nd toe longer)", type:"passfail", options:["No","Yes"] },
        { id:"f_mortons_left", label:"Morton's Toe — Left", type:"passfail", options:["No","Yes"] },
        { id:"f_hammer_right", label:"Hammer Toe — Right", type:"passfail", options:["None","Present"] },
        { id:"f_hammer_left", label:"Hammer Toe — Left", type:"passfail", options:["None","Present"] },
      ]},
      { id:"f2", title:"Arch", fields:[
        { id:"f_transverse_right", label:"Transverse Arch — Right", type:"text", placeholder:"normal / flat / high" },
        { id:"f_transverse_left", label:"Transverse Arch — Left", type:"text" },
        { id:"f_longitudinal_right", label:"Longitudinal Arch — Right", type:"text", placeholder:"normal / flat (pronated) / high (supinated)" },
        { id:"f_longitudinal_left", label:"Longitudinal Arch — Left", type:"text" },
      ]},
      { id:"f3", title:"Ankle & Calf", fields:[
        { id:"f_ankle_right", label:"Ankle Alignment — Right (neutral/valgus/varus)", type:"text" },
        { id:"f_ankle_left", label:"Ankle Alignment — Left", type:"text" },
        { id:"f_dorsiflexion_right", label:"Dorsiflexion — Right (normal >10°)", type:"passfail", options:["Pass","Restricted"] },
        { id:"f_dorsiflexion_left", label:"Dorsiflexion — Left", type:"passfail", options:["Pass","Restricted"] },
        { id:"f_heel_raise", label:"Single-leg Heel Raise — pass both sides", type:"passfail", options:["Pass","Fail"] },
        { id:"f_balance", label:"Balance Eyes Closed — 10 sec each side", type:"passfail", options:["Pass","Fail"] },
        { id:"f_notes", label:"Foot/ankle notes", type:"textarea" },
      ]},
    ]
  },
  structural: {
    id:"structural", name:"Structural Anomalies", icon:"🦷",
    color:C.indigo, colorDim:C.indigo+"12",
    sections:[
      { id:"st1", title:"Structural Tests", fields:[
        { id:"st_tibial", label:"Tibial Torsion — present", type:"passfail", options:["No","Yes"] },
        { id:"st_tibial_notes", label:"Tibial torsion notes", type:"textarea" },
        { id:"st_hip_height", label:"Seated Hip Height — level or uneven", type:"text" },
        { id:"st_leg_asymmetry", label:"Leg Bone Asymmetry — visual check", type:"text" },
        { id:"st_leg_length_right", label:"True Leg Length — Right (cm)", type:"text" },
        { id:"st_leg_length_left", label:"True Leg Length — Left (cm)", type:"text" },
        { id:"st_scoliosis", label:"Scoliosis — present", type:"passfail", options:["No","Possible","Yes"] },
        { id:"st_wsit", label:"W-Sit test — able to W-sit (femoral anteversion)", type:"passfail", options:["No","Yes"] },
        { id:"st_yogasit", label:"Yoga-Sit test — able to yoga sit", type:"passfail", options:["Yes","No"] },
        { id:"st_referral", label:"Doctor referral recommended", type:"passfail", options:["No","Yes"] },
        { id:"st_notes", label:"Structural notes", type:"textarea" },
      ]}
    ]
  },
  neckPosture: {
    id:"neckPosture", name:"Neck Posture & Function", icon:"🧲",
    color:C.sky, colorDim:C.sky+"12",
    sections:[
      { id:"np1", title:"Cervical Posture", fields:[
        { id:"np_curve", label:"Cervical Curve — normal / hyper / hypo / reversed", type:"text" },
        { id:"np_thoracic", label:"Thoracic Tilt — normal / kyphotic / flat", type:"text" },
        { id:"np_fhp", label:"Head Forward Posture — cm forward of ideal", type:"text" },
      ]},
      { id:"np2", title:"Nerve Function Screen C3–C8", fields:[
        { id:"np_empty_can", label:"Empty Can + King Atlas — weak or painful", type:"passfail", options:["Pass","Fail"] },
        { id:"np_hip_swing_neck", label:"Hip Swing + Neck Modifier", type:"passfail", options:["No change","Neck affects swing"] },
        { id:"np_upward_rotation", label:"Upward Rotation (serratus anterior)", type:"passfail", options:["Pass","Fail"] },
        { id:"np_shoulder_abduction", label:"Shoulder Abduction strength", type:"passfail", options:["Pass","Fail"] },
        { id:"np_trex_extensor", label:"T-Rex Extensor strength", type:"passfail", options:["Pass","Fail"] },
        { id:"np_trex_flexor", label:"T-Rex Flexor strength", type:"passfail", options:["Pass","Fail"] },
        { id:"np_finger_flexors", label:"Finger Flexors (grip)", type:"passfail", options:["Pass","Fail"] },
        { id:"np_notes", label:"Nerve function notes", type:"textarea" },
      ]},
    ]
  },
  neckSensitivity: {
    id:"neckSensitivity", name:"Neck Sensitivity Screen", icon:"⚡",
    color:C.red, colorDim:C.red+"12",
    sections:[
      { id:"nss1", title:"Pain Provocation — 20 reps each", fields:[
        { id:"nss_pain_move", label:"Personal Neck Pain Movement", type:"textarea" },
        { id:"nss_protrusion", label:"Head Protrusion — pain/symptoms", type:"passfail", options:["Clear","Pain/Symptoms"] },
        { id:"nss_protrusion_symptoms", label:"Protrusion symptoms", type:"textarea", placeholder:"e.g. tingling, sharp pain, dizziness" },
        { id:"nss_retraction", label:"Head Retraction — pain/symptoms", type:"passfail", options:["Clear","Pain/Symptoms"] },
        { id:"nss_retraction_symptoms", label:"Retraction symptoms", type:"textarea" },
        { id:"nss_flexion", label:"Neck Flexion — pain/symptoms", type:"passfail", options:["Clear","Pain/Symptoms"] },
        { id:"nss_flexion_symptoms", label:"Flexion symptoms", type:"textarea" },
        { id:"nss_extension", label:"Neck Extension — pain/symptoms", type:"passfail", options:["Clear","Pain/Symptoms"] },
        { id:"nss_extension_symptoms", label:"Extension symptoms", type:"textarea" },
        { id:"nss_sidebend_right", label:"Side Bend Right — pain/symptoms", type:"passfail", options:["Clear","Pain/Symptoms"] },
        { id:"nss_sidebend_left", label:"Side Bend Left — pain/symptoms", type:"passfail", options:["Clear","Pain/Symptoms"] },
        { id:"nss_sidebend_symptoms", label:"Side bend symptoms", type:"textarea" },
        { id:"nss_rotation_right", label:"Rotation Right — pain/symptoms", type:"passfail", options:["Clear","Pain/Symptoms"] },
        { id:"nss_rotation_left", label:"Rotation Left — pain/symptoms", type:"passfail", options:["Clear","Pain/Symptoms"] },
        { id:"nss_rotation_symptoms", label:"Rotation symptoms", type:"textarea" },
      ]}
    ]
  },
  speedy6: {
    id:"speedy6", name:"Speedy 6 Neck Mobility", icon:"🔄",
    color:C.teal, colorDim:C.teal+"12",
    sections:[
      { id:"s6s1", title:"6 Movements — Pass/Fail with notes", fields:[
        { id:"s6_rotation_right", label:"Neck Rotation Right", type:"passfail", options:["Pass","Fail"] },
        { id:"s6_rotation_left", label:"Neck Rotation Left", type:"passfail", options:["Pass","Fail"] },
        { id:"s6_protraction", label:"Head Protraction", type:"passfail", options:["Pass","Fail"] },
        { id:"s6_retraction", label:"Neck Retraction", type:"passfail", options:["Pass","Fail"] },
        { id:"s6_extension", label:"Neck Extension", type:"passfail", options:["Pass","Fail"] },
        { id:"s6_flexion", label:"Neck Flexion", type:"passfail", options:["Pass","Fail"] },
        { id:"s6_sidebend_right", label:"Neck Side Bend Right", type:"passfail", options:["Pass","Fail"] },
        { id:"s6_sidebend_left", label:"Neck Side Bend Left", type:"passfail", options:["Pass","Fail"] },
        { id:"s6_compensations", label:"Compensations observed", type:"textarea" },
        { id:"s6_notes", label:"Baseline notes / date", type:"textarea" },
      ]}
    ]
  },
  shoulderPosture: {
    id:"shoulderPosture", name:"Shoulder Posture & Function", icon:"🏋️",
    color:C.orange, colorDim:C.orange+"12",
    sections:[
      { id:"sp1", title:"Humerus & Collarbone", fields:[
        { id:"sp_humerus_right", label:"Humerus Rotation — Right (internal/neutral/external)", type:"text" },
        { id:"sp_humerus_left", label:"Humerus Rotation — Left", type:"text" },
        { id:"sp_collarbone", label:"Collarbone Angle — level or elevated side", type:"text" },
        { id:"sp_ac_joint", label:"AC Joint Step Deformity — present", type:"passfail", options:["No","Yes"] },
        { id:"sp_ac_side", label:"AC Joint — which side", type:"text" },
        { id:"sp_carrying_angle", label:"Humeral Carrying Angle — normal/increased", type:"text" },
      ]},
      { id:"sp2", title:"Scapula", fields:[
        { id:"sp_scapula_position", label:"Scapula Position — protracted / retracted / elevated / depressed", type:"text" },
        { id:"sp_winging_right", label:"Scapula Winging — Right", type:"passfail", options:["None","Present"] },
        { id:"sp_winging_left", label:"Scapula Winging — Left", type:"passfail", options:["None","Present"] },
        { id:"sp_tilting", label:"Scapula Tilting (anterior)", type:"passfail", options:["None","Present"] },
      ]},
      { id:"sp3", title:"Rotator Cuff Round Robin", fields:[
        { id:"sp_supraspinatus", label:"Supraspinatus (empty can)", type:"passfail", options:["Pass","Fail"] },
        { id:"sp_infraspinatus", label:"Infraspinatus (external rotation)", type:"passfail", options:["Pass","Fail"] },
        { id:"sp_subscapularis", label:"Subscapularis (internal rotation)", type:"passfail", options:["Pass","Fail"] },
        { id:"sp_teres_minor", label:"Teres Minor (ER at 90°)", type:"passfail", options:["Pass","Fail"] },
        { id:"sp_notes", label:"Shoulder posture notes", type:"textarea" },
      ]},
    ]
  },
  speedy7: {
    id:"speedy7", name:"Speedy 7 Shoulder Mobility", icon:"💨",
    color:C.indigo, colorDim:C.indigo+"12",
    sections:[
      { id:"s7s1", title:"7 Movements", fields:[
        { id:"s7_thoracic_ext", label:"Thoracic Extension", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_flexion_right", label:"Shoulder Flexion — Right (normal 180°)", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_flexion_left", label:"Shoulder Flexion — Left", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_extension_right", label:"Shoulder Extension — Right", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_extension_left", label:"Shoulder Extension — Left", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_overhead_right", label:"Overhead Arc — Right (painful arc 60–120°)", type:"passfail", options:["Clear","Painful arc"] },
        { id:"s7_overhead_left", label:"Overhead Arc — Left", type:"passfail", options:["Clear","Painful arc"] },
        { id:"s7_horizontal_right", label:"Horizontal Abduction — Right", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_horizontal_left", label:"Horizontal Abduction — Left", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_internal_right", label:"Internal Rotation — Right", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_internal_left", label:"Internal Rotation — Left", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_external_right", label:"External Rotation — Right", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_external_left", label:"External Rotation — Left", type:"passfail", options:["Pass","Fail"] },
        { id:"s7_notes", label:"Baseline / tracking notes", type:"textarea" },
      ]}
    ]
  },
  shoulderSensitivity: {
    id:"shoulderSensitivity", name:"Shoulder Sensitivity Screen", icon:"🩻",
    color:C.red, colorDim:C.red+"12",
    sections:[
      { id:"ss1", title:"Special Tests", fields:[
        { id:"ss_supraspinatus_lag", label:"Supraspinatus Lag Sign", type:"passfail", options:["Negative","Positive"] },
        { id:"ss_infraspinatus_lag", label:"Infraspinatus Lag Sign", type:"passfail", options:["Negative","Positive"] },
        { id:"ss_subscapularis", label:"Subscapularis Rupture Test", type:"passfail", options:["Negative","Positive"] },
        { id:"ss_ludingtons", label:"Modified Ludington's (biceps)", type:"passfail", options:["Negative","Positive"] },
        { id:"ss_slap", label:"SLAP Lesion Test", type:"passfail", options:["Negative","Positive"] },
        { id:"ss_impingement", label:"Impingement Test (Neer/Hawkins)", type:"passfail", options:["Negative","Positive"] },
        { id:"ss_painful_arc", label:"Painful Arc (60–120°)", type:"passfail", options:["Negative","Positive"] },
        { id:"ss_apprehension", label:"Apprehension + Relocation Test", type:"passfail", options:["Negative","Positive"] },
        { id:"ss_notes", label:"Sensitivity screen notes / referral", type:"textarea" },
      ]}
    ]
  },
}

export const MAIN_ASSESSMENTS = [
  ALL_ASSESSMENTS.hypermobility,
  ALL_ASSESSMENTS.prime8,
  ALL_ASSESSMENTS.foot,
  ALL_ASSESSMENTS.hip,
  ALL_ASSESSMENTS.knee,
  ALL_ASSESSMENTS.structural,
  ALL_ASSESSMENTS.neck,
  ALL_ASSESSMENTS.neckPosture,
  ALL_ASSESSMENTS.neckSensitivity,
  ALL_ASSESSMENTS.speedy6,
  ALL_ASSESSMENTS.shoulderPosture,
  ALL_ASSESSMENTS.speedy7,
  ALL_ASSESSMENTS.shoulderSensitivity,
]
