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
        { id:"p8_duck_right", label:"Duck Foot Test — Right (feet turn out >15°)", type:"passfail", options:["Pass","Fail Right"],
          failNotes:"Tests: Peroneals & Hip External Rotation (resilience to ankle rolling)\n\nIF BELOW 7/10:\n• Perform a Foot & Ankle Assessment for more info\n• If ready to solve → try the DUCK PROTOCOL and retest for immediate improvement" },
        { id:"p8_duck_left", label:"Duck Foot Test — Left", type:"passfail", options:["Pass","Fail Left"],
          failNotes:"Tests: Peroneals & Hip External Rotation (resilience to ankle rolling)\n\nIF BELOW 7/10:\n• Perform a Foot & Ankle Assessment for more info\n• If ready to solve → try the DUCK PROTOCOL and retest for immediate improvement" },
        { id:"p8_pigeon_right", label:"Pigeon Foot Test — Right (feet turn in)", type:"passfail", options:["Pass","Fail Right"],
          failNotes:"Tests: Arch Strength, Tibialis Posterior & Hip Internal Rotation\nWeakness can cause arch flattening → bunions, heel spurs, shin splints, balance problems\n\nIF BELOW 7/10:\n• Perform a Foot & Ankle Assessment for more info\n• If ready to solve → try the PIGEON PROTOCOL and retest for immediate improvement" },
        { id:"p8_pigeon_left", label:"Pigeon Foot Test — Left", type:"passfail", options:["Pass","Fail Left"],
          failNotes:"Tests: Arch Strength, Tibialis Posterior & Hip Internal Rotation\nWeakness can cause arch flattening → bunions, heel spurs, shin splints, balance problems\n\nIF BELOW 7/10:\n• Perform a Foot & Ankle Assessment for more info\n• If ready to solve → try the PIGEON PROTOCOL and retest for immediate improvement" },
        { id:"p8_gas_right", label:"Gas Pedal Test — Right ankle (dorsiflexion <10°)", type:"passfail", options:["Pass","Fail Right"],
          failNotes:"Tests: Shins (tibialis anterior muscle) &/or Low Back (nerve/circuitry)\n\nIF BELOW 7/10 → do Standing Gas Pedal Test (back against wall, don't look down):\n• STRONGER standing = potential low back issue (spinal compression). Consider low back assessment or CALFZILLA PROTOCOL\n• STILL WEAK standing = ensure client looked straight ahead. Consider Foot & Ankle Assessment. Try CALFZILLA PROTOCOL and retest\n• OPTION: Have them press lower back against wall and retest. If better → possible anterior pelvic tilt. Try LE BUTTE ANTERIOR PROTOCOL and retest",
          modifiers:["Stronger standing → CALFZILLA PROTOCOL (low back issue)","Still weak standing → CALFZILLA PROTOCOL (foot/ankle)","Lower back against wall → LE BUTTE ANTERIOR PROTOCOL (anterior pelvic tilt)","No modifier helped"] },
        { id:"p8_gas_left", label:"Gas Pedal Test — Left ankle", type:"passfail", options:["Pass","Fail Left"],
          failNotes:"Tests: Shins (tibialis anterior muscle) &/or Low Back (nerve/circuitry)\n\nIF BELOW 7/10 → do Standing Gas Pedal Test (back against wall, don't look down):\n• STRONGER standing = potential low back issue (spinal compression). Consider low back assessment or CALFZILLA PROTOCOL\n• STILL WEAK standing = ensure client looked straight ahead. Consider Foot & Ankle Assessment. Try CALFZILLA PROTOCOL and retest\n• OPTION: Have them press lower back against wall and retest. If better → possible anterior pelvic tilt. Try LE BUTTE ANTERIOR PROTOCOL and retest",
          modifiers:["Stronger standing → CALFZILLA PROTOCOL (low back issue)","Still weak standing → CALFZILLA PROTOCOL (foot/ankle)","Lower back against wall → LE BUTTE ANTERIOR PROTOCOL (anterior pelvic tilt)","No modifier helped"] },
        { id:"p8_hip_swing_right", label:"Hip Swing Test (Right Side) — any restriction or pain", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: General Hip Dysfunction — Sacrum, Gluteal Nerve & Muscles\n⚠️ No phone in pocket, no gum chewing during test\n\nIF WEAK — try each modifier in order until one helps:\n1. SAME SIDE shoulder shrug → if stronger: do Structural Anomalies Assessment. Try HIP HIP HOORAY for opposite hip\n2. OPPOSITE SIDE shoulder shrug → if stronger: try HIP HIP HOORAY for test side hip\n3. SI JOINT STABILIZER: Pull abs up & in + kegel → if better: try PELVIS PRESLEY & avoid deep hip stretches\n4. TIP PELVIS BACKWARD (posterior tilt) → if better: possible anterior pelvic tilt. Try LE BUTTE ANTERIOR & retest\n5. PRESS HIP FLEXOR: Press front of hips → if better: possible posterior tilt. Try LE BUTTE POSTERIOR\n\n• Do HIP & PELVIS ASSESSMENT for further clarity\n• Consider the issue may come from another body area\n• If unsure → try PELVIS PRESLEY",
          modifiers:["Same side shoulder shrug → HIP HIP HOORAY (opposite hip)","Opposite side shoulder shrug → HIP HIP HOORAY (test side)","SI joint stabilizer (abs + kegel) → PELVIS PRESLEY","Tip pelvis backward → LE BUTTE ANTERIOR","Press hip flexor → LE BUTTE POSTERIOR","No modifier helped"] },
        { id:"p8_hip_swing_left", label:"Hip Swing Test (Left Side) — any restriction or pain", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: General Hip Dysfunction — Sacrum, Gluteal Nerve & Muscles\n⚠️ No phone in pocket, no gum chewing during test\n\nIF WEAK — try each modifier in order until one helps:\n1. SAME SIDE shoulder shrug → if stronger: do Structural Anomalies Assessment. Try HIP HIP HOORAY for opposite hip\n2. OPPOSITE SIDE shoulder shrug → if stronger: try HIP HIP HOORAY for test side hip\n3. SI JOINT STABILIZER: Pull abs up & in + kegel → if better: try PELVIS PRESLEY & avoid deep hip stretches\n4. TIP PELVIS BACKWARD (posterior tilt) → if better: possible anterior pelvic tilt. Try LE BUTTE ANTERIOR & retest\n5. PRESS HIP FLEXOR: Press front of hips → if better: possible posterior tilt. Try LE BUTTE POSTERIOR\n\n• Do HIP & PELVIS ASSESSMENT for further clarity\n• Consider the issue may come from another body area\n• If unsure → try PELVIS PRESLEY",
          modifiers:["Same side shoulder shrug → HIP HIP HOORAY (opposite hip)","Opposite side shoulder shrug → HIP HIP HOORAY (test side)","SI joint stabilizer (abs + kegel) → PELVIS PRESLEY","Tip pelvis backward → LE BUTTE ANTERIOR","Press hip flexor → LE BUTTE POSTERIOR","No modifier helped"] },
        { id:"p8_kneecap_right", label:"Knee Cap Grind Test (Right Side) — crepitus or pain", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: Rate of Wear & Tear on the Knee Joint\n\nIF GRINDING FOUND:\n• Have client feel it — assess as 'minor' or 'major' grinding\n• Advise: avoid excess knee bends. Use resistance training circuits instead of traditional cardio\n• Minimize future wear with BEES KNEES HIGH KNEE CAP / TIGHT QUAD PROTOCOL\n\nIF PAIN:\n• Push kneecap OUTWARD while retesting → if pain improves: try BEES KNEES KNOCK KNEE\n• Push kneecap INWARD while retesting → if pain improves: try BEES KNEES BOW LEGGED",
          modifiers:["Grinding → BEES KNEES HIGH KNEE CAP / TIGHT QUAD PROTOCOL","Kneecap outward is better → BEES KNEES KNOCK KNEE","Kneecap inward is better → BEES KNEES BOW LEGGED","No modifier helped"] },
        { id:"p8_kneecap_left", label:"Knee Cap Grind Test (Left Side) — crepitus or pain", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: Rate of Wear & Tear on the Knee Joint\n\nIF GRINDING FOUND:\n• Have client feel it — assess as 'minor' or 'major' grinding\n• Advise: avoid excess knee bends. Use resistance training circuits instead of traditional cardio\n• Minimize future wear with BEES KNEES HIGH KNEE CAP / TIGHT QUAD PROTOCOL\n\nIF PAIN:\n• Push kneecap OUTWARD while retesting → if pain improves: try BEES KNEES KNOCK KNEE\n• Push kneecap INWARD while retesting → if pain improves: try BEES KNEES BOW LEGGED",
          modifiers:["Grinding → BEES KNEES HIGH KNEE CAP / TIGHT QUAD PROTOCOL","Kneecap outward is better → BEES KNEES KNOCK KNEE","Kneecap inward is better → BEES KNEES BOW LEGGED","No modifier helped"] },
        { id:"p8_empty_can_right", label:"Empty Can Test (Right Side) — shoulder weakness or pain", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: General Shoulder Dysfunction (supraspinatus)\n\nIF BELOW 7/10 — try modifiers in order:\n1. CLAMPING TOP OF SHOULDER (AC joint) is better → possible AC joint instability. For 6-8 weeks: cut out dips & bench press (try floor press). Do narrow grip pushing & pulling\n2. SHOULDERS UP is better → do downward dog, overhead presses, shrugs. Avoid exercises that depress shoulders down\n3. SHOULDERS DOWN is better → do lat pulldowns, W-retractions, deadlifts, bicep curls. Avoid exercises that bring shoulders up\n4. SHOULDERS BACK is better → mid-back needs tightening. Do wide grip pulling. Back-to-chest exercise ratio 3:1",
          modifiers:["Lower Body Cause: Re-test in sitting","Clamp AC Joint","Shrug Shoulders","Depress Shoulders","Press on Rhomboid","No modifier helped"] },
        { id:"p8_empty_can_left", label:"Empty Can Test (Left Side) — shoulder weakness or pain", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: General Shoulder Dysfunction (supraspinatus)\n\nIF BELOW 7/10 — try modifiers in order:\n1. CLAMPING TOP OF SHOULDER (AC joint) is better → possible AC joint instability. For 6-8 weeks: cut out dips & bench press (try floor press). Do narrow grip pushing & pulling\n2. SHOULDERS UP is better → do downward dog, overhead presses, shrugs. Avoid exercises that depress shoulders down\n3. SHOULDERS DOWN is better → do lat pulldowns, W-retractions, deadlifts, bicep curls. Avoid exercises that bring shoulders up\n4. SHOULDERS BACK is better → mid-back needs tightening. Do wide grip pulling. Back-to-chest exercise ratio 3:1",
          modifiers:["Lower Body Cause: Re-test in sitting","Clamp AC Joint","Shrug Shoulders","Depress Shoulders","Press on Rhomboid","No modifier helped"] },
        { id:"p8_neck_rotation_right", label:"Neck Rotation Test (Right Side) — restricted or painful", type:"passfail", options:["Pass","Fail"],
          fingerWidths: true,
          failNotes:"Tests: Rotational Spine Imbalance or Neck Dysfunction\nNormal = inside edge of nose within 2 finger-widths of AC joint\n\nIF MORE THAN 2 FINGER-WIDTHS:\n• Get more info → do a NECK ASSESSMENT\n• Consider referral out\n• Attempt to correct other body imbalances and retest neck for improvement" },
        { id:"p8_neck_rotation_left", label:"Neck Rotation Test (Left Side) — restricted or painful", type:"passfail", options:["Pass","Fail"],
          fingerWidths: true,
          failNotes:"Tests: Rotational Spine Imbalance or Neck Dysfunction\nNormal = inside edge of nose within 2 finger-widths of AC joint\n\nIF MORE THAN 2 FINGER-WIDTHS:\n• Get more info → do a NECK ASSESSMENT\n• Consider referral out\n• Attempt to correct other body imbalances and retest neck for improvement" },
        { id:"p8_stress", label:"Stress Check-In — current stress level (1–10)", type:"scale", min:1, max:10,
          failNotes:"IF 7/10 OR ABOVE:\n\"I have some mental toughness tools that could really help you reduce stress levels, and feel better. Would you be interested?\"\n\nIF BELOW 7/10:\n\"I have some mental toughness tools that could help you feel even better. Would you be interested?\"" },
        { id:"p8_notes", label:"Additional notes / observations", type:"textarea" },
      ]}
    ]
  },
  neck: {
    id:"neck", name:"Neck & Shoulder Gauntlet", icon:"💪",
    color:C.sky, colorDim:C.sky+"12",
    sections:[
      { id:"ns1", title:"6 Tests", fields:[
        { id:"ns_pain_move", label:"Personal Pain Movement — describe", type:"textarea",
          failNotes:"\"Without hurting yourself further, what movement or posture can you reproduce pain or symptoms with? Show me RIGHT NOW.\"\n\n• WHERE and WHEN does it cause pain? HOW MUCH on a scale of 1–10?\n• If they have pain, get further clarity:\n  → Neck Sensitivity Screen\n  → Shoulder Sensitivity Screen" },
        { id:"ns_hip_swing", label:"Hip Swing (Neck Influence) — does neck position change hip swing?", type:"passfail", options:["No change","Yes — neck affects swing"],
          failNotes:"Tests: How Neck Posture Affects Lower Body\n⚠️ No phone in pocket before testing\n\nIF WEAK — try modifiers in order (stop when one makes ≥20% improvement):\n1. CHIN BACK TO MID-NECK (retraction) → if better: try NECK SAVVY EXCESS C-CURVE\n2. LOOK UP → if better: try NECK SAVVY FLAT C-CURVE PROTOCOL (works when neck/spine is excessively straight)\n3. NECK TRACTION (client pulls up on own head) → if better: try LEONARDO DA NECKY (works for compressed or \"scrambled neck\")\n4. NECK EXTENSION (hands behind head, extend back) → if better: try NECK MATE (works for forward head posture)\n5. SIDE NECK PRESSURE (same side upper neck as test leg) → if better: try KING ATLAS PROTOCOL for test side (lateral upper-neck imbalance)\n\nIF NO MODIFIERS HELP:\n• Consider doing lower body assessments for more clarity",
          modifiers:["Chin back to mid-neck → NECK SAVVY EXCESS C-CURVE","Look up → NECK SAVVY FLAT C-CURVE PROTOCOL","Neck traction (pull up on head) → LEONARDO DA NECKY","Neck extension (hands behind head) → NECK MATE","Side neck pressure (same side) → KING ATLAS PROTOCOL","No modifier helped"] },
        { id:"ns_trex", label:"T-Rex Wrist Extensor — wrist weakness with elbow bent", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: Lower Cervical / Radial Nerve (wrist extensors)\n\nIF BELOW 7/10 — try modifiers in sequence:\n1. CHIN BACK TO MID-NECK (retraction, angle to stack neck bones) → if better: try NECK SAVVY EXCESS C-CURVE\n2. WALL LEAN (shoulders OFF wall, no neck bend) → if better: try NECK MATE PROTOCOL\n3. LOOK UP → if better: try NECK SAVVY FLAT C-CURVE PROTOCOL\n4. SEATED OR LYING → if better: assess LOWER BODY for postural tension working up the body\n5. SQUEEZE SHOULDER BLADES TOGETHER → if better: try THORACIC PARK WIDE SHOULDER\n6. BRACE RADIUS & ULNA TOGETHER → if better: could be true wrist problem. Try EDGAR ALLAN ELBOW",
          modifiers:["Chin back to mid-neck → NECK SAVVY EXCESS C-CURVE","Wall lean → NECK MATE PROTOCOL","Look up → NECK SAVVY FLAT C-CURVE PROTOCOL","Seated or lying → Assess LOWER BODY","Squeeze shoulder blades → THORACIC PARK WIDE SHOULDER","Brace radius & ulna → EDGAR ALLAN ELBOW (true wrist problem)","No modifier helped"] },
        { id:"ns_trex_side", label:"T-Rex — which side", type:"text" },
        { id:"ns_full_can", label:"Full Can Side Raise — pain or weakness at 90° abduction", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: Primarily Serratus Anterior\n(Client: arm out to side, thumb up, keep looking straight ahead)\n\nIF BELOW 7/10 — try modifiers in sequence:\n1. FIST INTO UPPER SIDE OF RIBS → if better: try SHOULDER SUPERIOR or THORACIC PARK NARROW SHOULDERS\n2. CHIN BACK TO MID-NECK → if better: try NECK SAVVY EXCESS C-CURVE\n3. SEATED → if better: problem from lower body. Often low arches → consider PIGEON PROTOCOL\n4. PRESS ON SUPRASPINATUS (above spine of scapula) → if better: try ROTATOR CUP PROTOCOL\n5. SHOULDERS UP (shrug) → if better: try SHOULDER SUPERIOR or NECK SAVVY FLAT CURVE\n6. WALL LEAN → if better: try NECK MATE\n7. LOOK UP → if better: try NECK SAVVY FLAT CURVE\n\nSTILL WEAK?\n• Clamp AC joint → if better: try SHOULDER SAVIOR\n• Shoulder may be too high → try SHOULDER STORY\n• Posterior scalene tension compressing long thoracic nerve → try WING NUT or NECK MATE\n• GH instability → try ROTATOR CUP PROTOCOL\n• Possible long thoracic nerve damage → consider referring out",
          modifiers:["Fist into upper ribs → SHOULDER SUPERIOR / THORACIC PARK NARROW SHOULDERS","Chin back to mid-neck → NECK SAVVY EXCESS C-CURVE","Seated → PIGEON PROTOCOL (lower body / low arches)","Press on supraspinatus → ROTATOR CUP PROTOCOL","Shoulders up (shrug) → SHOULDER SUPERIOR / NECK SAVVY FLAT CURVE","Wall lean → NECK MATE","Look up → NECK SAVVY FLAT CURVE","AC joint clamp → SHOULDER SAVIOR","Shoulder too high → SHOULDER STORY","Posterior scalene → WING NUT / NECK MATE","GH instability → ROTATOR CUP PROTOCOL","Possible nerve damage → Refer out","No modifier helped"] },
        { id:"ns_full_can_side", label:"Full Can — which side", type:"text" },
        { id:"ns_empty_can", label:"Empty Can Test — supraspinatus weakness", type:"passfail", options:["Pass","Fail"],
          failNotes:"Tests: General Shoulder Dysfunction (supraspinatus)\n\nIF BELOW 7/10 — try modifiers in sequence:\n1. SEATED → if better: do LOWER BODY ASSESSMENT (likely twist, anterior pelvic tilt, or low arches)\n2. AC CLAMP (pinch clavicle & shoulder blade together) → if better: try SHOULDER SAVIOR\n3. PRESS FRONT OF SHOULDER (subscapularis) → if better: try BREAKTHROUGH\n4. SHOULDERS UP (shrug) → if better: try SHOULDER SUPERIOR or NECK SAVVY FLAT C-CURVE\n5. PRESS DOWN ON SHOULDER → if better: try SHOULDER STORY PROTOCOL\n6. COMPRESS SIDE OF RIBS (serratus anterior) → if better: try SUPER SHOULDER DOWN\n7. SAME SIDE UPPER NECK PRESSURE → if better: try KING ATLAS PROTOCOL for test side\n8. PRESS ON RHOMBOID (same side, between shoulder blade & midspine) → if better: try THORACIC PARK WIDE SHOULDERS\n\nDo you think stress could be a factor?\n• If yes → offer mental toughness discussions",
          modifiers:["Seated → LOWER BODY ASSESSMENT","AC clamp → SHOULDER SAVIOR","Press front of shoulder → BREAKTHROUGH","Shoulders up (shrug) → SHOULDER SUPERIOR / NECK SAVVY FLAT C-CURVE","Press down on shoulder → SHOULDER STORY PROTOCOL","Compress side of ribs → SUPER SHOULDER DOWN","Same side upper neck pressure → KING ATLAS PROTOCOL","Press on rhomboid → THORACIC PARK WIDE SHOULDERS","No modifier helped"] },
        { id:"ns_empty_can_side", label:"Empty Can — which side", type:"text" },
        { id:"ns_mental_stress", label:"Mental Stress Connection — symptoms worsen with stress", type:"passfail", options:["No","Yes"],
          failNotes:"BREAKOUT ASSESSMENTS TO CONSIDER:\n• Neck Posture & Function Breakout\n• Neck Sensitivity Screen\n• Speedy 6 Neck Mobility Breakout\n• Shoulder Posture & Function Breakout\n• Shoulder Sensitivity Screen\n• Speedy 7 Shoulder Breakout\n\nMENTAL TOUGHNESS DRILLS TO OFFER:\n1. \"Do you feel you could benefit from more mental resilience?\" → PROBLEM POWERLIFTER handout\n2. \"Do you want to improve communication with loved ones?\" → LOVE LANGUAGES handout\n3. \"Could you benefit from hopeful courage after a major transition?\" → WHEN GOOD THINGS FALL APART handout\n4. \"Could you benefit from greater appreciation and happiness?\" → G-FORCE (gratitude) handout",
          modifiers:["PROBLEM POWERLIFTER handout (mental resilience)","LOVE LANGUAGES handout (communication)","WHEN GOOD THINGS FALL APART handout (transitions)","G-FORCE handout (gratitude / appreciation)"] },
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
  bms5: {
    id:"bms5", name:"BMS-5 Baseline Movement Screen", icon:"🏆",
    color:C.green, colorDim:C.green+"12",
    sections:[
      { id:"bms_info", title:"Client Info", fields:[
        { id:"bms_gender", label:"Gender (affects pushup scoring)", type:"passfail", options:["Male","Female"] },
        { id:"bms_age_range", label:"Age Range", type:"passfail", options:["18–39","40–49","50–59","60+"] },
        { id:"bms_shoes", label:"Footwear for testing", type:"text", placeholder:"e.g. exercise shoes, sock feet" },
      ]},
      { id:"bms_squat", title:"1. Overhead Squat — Squat Pattern", fields:[
        { id:"bms_sq_score", label:"Overhead Squat Score (0–3)", type:"scale", min:0, max:3,
          failNotes:"SCORING:\n• 3 Points: Perfect rep — arms overhead, palms forward. Hands don't pass feet, thighs below parallel, knees don't buckle, feet stay in footprint, no buttwink.\n• 2 Points: Perfect rep with arms held straight out front (not overhead).\n• 1 Point: Can't achieve perfect rep at all.\n• 0 Points: Pain ANYWHERE.\n\nINSTRUCTIONS:\n1. Wear exercise shoes. Don't test on rubber floor.\n2. Hop up and down to find natural foot placement.\n3. Arms straight overhead, palms forward, no elbow bend.\n4. \"Squat down as low as you can, keeping as upright as you can.\"\n5. Give 3 attempts, score best attempt.\n6. If can't do arms overhead (3 pts), try arms forward (2 pts). If can't do either, move to lying squat pose." },
        { id:"bms_sq_compensations", label:"Compensations observed", type:"textarea",
          failNotes:"COMMON COMPENSATIONS:\n• Knees buckle in: Poor movement strategy, tight adductors, inactive glutes. Cue \"pushing knees out\". Consider Bees Knees Knock Knee, groin stretches, glute exercises.\n• Poor Depth: Anterior posture tension, forward spine bend strategy. Cue \"hip hinge\".\n• Excess Forward Bend: Upper/lower crossed syndrome, tight calves, insufficient trunk stability. Promote belly breathing. Cue \"bracing abs\", hold in-breath on way down, \"hip hinge\".\n• Rotation/thigh tremble at bottom: Spinal compression or pelvic twist. Consider Great Decompression or Hip Hip Hooray. Don't squat with high load.\n• Feet turn out: Tibial torsion, tight external hip rotators, weak tibialis posterior/adductors. Consider Bees Knees Bowlegged or Pigeon Protocol. Cue \"foot slightly scrunched\". Try ball between knees.\n• Buttwink/low back hinge: Lack of hip mobility causing posterior pelvic tilt in flexion. Consider Rocky and Buttwinkel. Anterior core control exercises. Goblet Squats and Sit Down Squats are ideal choices." },
        { id:"bms_sq_lying", label:"Lying Squat Pose needed?", type:"passfail", options:["Not needed","Yes — performed"] },
        { id:"bms_sq_lying_arms", label:"Lying Squat — Arms flat on floor equally?", type:"passfail", options:["Yes","No — shoulders tight"],
          failNotes:"If arms dangle up higher than toes, shoulders are a limitation. If one arm higher than the other, it will create uneven torsion (also a fail)." },
        { id:"bms_sq_lying_knees", label:"Lying Squat — Knees flex past hips (>90°)?", type:"passfail", options:["Yes","No — posterior chain tight"],
          failNotes:"Could be posterior chain tension (tight hamstrings) or hip flexor weakness. Consider Le Butte Posterior." },
        { id:"bms_sq_lying_ankles", label:"Lying Squat — Feet dorsiflex ~10°?", type:"passfail", options:["Yes","No — tight calves"],
          failNotes:"Tight calves and/or tibialis anterior dysfunction. Consider Calfzilla protocol." },
        { id:"bms_sq_lying_result", label:"Lying Squat Result", type:"passfail", options:["Can do — stability limitation","Can't do — mobility limitation"],
          failNotes:"CAN DO (stability limitation): Improper or insufficient muscle activation and movement strategy may be the limitation. Delayed transversus abdominis recruitment can cause other muscles to stiffen as compensation.\n\nCAN'T DO (mobility limitation): Flexibility of muscles or structural limitations are the probable limiting factor. Apply corrective protocols for limited areas." },
        { id:"bms_sq_notes", label:"Squat notes", type:"textarea" },
      ]},
      { id:"bms_lunge", title:"2. Tightrope Lunge — Lunge Pattern", fields:[
        { id:"bms_lu_score_left", label:"Tightrope Lunge Score — Left (0–3)", type:"scale", min:0, max:3,
          failNotes:"SCORING:\n• 3 Points: Perfect rep with EYES CLOSED. Hands don't go past toes, no lateral torso movement, stay in footprint, looks easy.\n• 2 Points: Perfect rep with EYES OPEN.\n• 1 Point: Can't achieve movement without significant compensation (loss of balance, rotation, extreme forward bend). Or can't achieve/maintain start position.\n• 0 Points: Pain ANYWHERE.\n\nINSTRUCTIONS:\n1. Setup beside a wall for balance.\n2. Start at the bottom — kneel like proposing.\n3. In-line stance: front heel touching back knee, like standing on tightrope.\n4. Arms straight overhead, palms forward. This is start position.\n5. If can't achieve this position within 5 seconds = score of 1.\n6. Stand up tall, then lunge down until knee taps floor, return all the way up until front leg straight.\n7. 3 attempts per side. If perfect with eyes open, try eyes closed for 3 points." },
        { id:"bms_lu_score_right", label:"Tightrope Lunge Score — Right (0–3)", type:"scale", min:0, max:3 },
        { id:"bms_lu_compensations", label:"Compensations observed", type:"textarea",
          failNotes:"COMMON COMPENSATIONS:\n• Lateral instability/wobble: General instability or lack of scissor stance stability. Consider Pelvis Presley, practice proper lunge technique and position holds. Could be poor knee tracking from lateral leg misalignments.\n• Front heel rises or poor depth: Quad dominance or tight calves. Consider Bees Knees High Knee Cap and/or Calfzilla.\n• Excess forward bend, arms past toes: Compromised trunk stability or too much tightness in front of body. Consider Le Butte Anterior, Thoracic Park, and/or Neck Mate." },
        { id:"bms_lu_notes", label:"Lunge notes", type:"textarea" },
      ]},
      { id:"bms_row", title:"3. Dumbbell Bentover Row — Pull Pattern & Bilateral Bend", fields:[
        { id:"bms_row_score", label:"Bentover Row Score (0–3)", type:"scale", min:0, max:3,
          failNotes:"SCORING:\n• 3 Points: Correct rep with no faults — pull initiated by upper back/shoulder blades, full range up and down, no torso motion, spine straight, neck aligned, no forward shoulder shift.\n• 2 Points: Only 1 compensation. After coaching, they correct it immediately (shows it's not a fixed tendency).\n• 1 Point: After coaching, faults still evident. Begin with isolated pulling motions, advance to compound. E.g. rows face down on incline bench → seated row → bentover rows with butt on wall.\n• 0 Points: Pain ANYWHERE.\n\nINSTRUCTIONS:\n1. Demo: legs wide, knees slightly bent, 15-30lb dumbbells inside legs.\n2. Lean forward 45°, straight back.\n3. Palms facing each other, squeeze shoulder blades, pull dumbbells beside waist.\n4. Slowly lower (fight gravity). Keep neck straight.\n5. Demo 3 reps, then have them do 3 reps or until perfect rep." },
        { id:"bms_row_compensations", label:"Compensations observed", type:"textarea",
          failNotes:"COMMON COMPENSATIONS:\n• Lack of shoulder blade movement: Pulling via elbow flexion (bicep curl style) or only 2/3 range. Omits scapular retractor activation. Root cause: weak upper back, arms compensate.\n• Rounding lower back: Relying on passive spinal support instead of postural stabilizers. May need upper back mobilizations (foam roll, towel) and scapular retraction exercises.\n• Low back extension / leaning back: Using low back as a functional shoulder. Leads to excess spinal motion. Focus on isolated pulls (face-down incline bench rows).\n• Anterior shoulder dumping at end of pull: Forward shoulder shift for extra range. Strains anterior capsule. Usually a coaching fix. If capsule is loose, consider Shoulder Breakthrough Corrective.\n• Neck/head movement: Chin should be tucked to mid-neck. Head poking forward or looking up/down = limited shoulder mobility. Cue \"neck packed\"." },
        { id:"bms_row_notes", label:"Row notes", type:"textarea" },
      ]},
      { id:"bms_hinge", title:"4. Unilateral Hip Hinge \"Bowing to Buddha\" — Hip Hinge & Rotation", fields:[
        { id:"bms_hh_score_left", label:"Bowing to Buddha Score — Left (0–3)", type:"scale", min:0, max:3,
          failNotes:"SCORING:\n• 3 Points: Perfect rep with control. Does not appear to take significant effort.\n• 2 Points: Rep with minor compensations (instability) or appears to take significant effort.\n• 1 Point: Poor control. Can't do movement or \"crashes down\".\n• 0 Points: Pain ANYWHERE.\nNOTE: If different score right vs left, the lower score is the overall score.\n\nINSTRUCTIONS:\n1. Begin on all 4's, slide one knee straight forward, other straight back.\n2. Both knees on ground. Legs straight forward & back, no crossing.\n3. Butt down over back heel as deep as possible.\n4. Elbows on ground touching lead knee on either side, hands in prayer.\n5. If front knee sensitive, place folded towel behind lead knee.\n6. Back foot flat, laces down.\n7. \"Freeze lower body & arms. Lift upper body from horizontal to vertical, and back down.\"\n8. 3 attempts per side or until perfect rep." },
        { id:"bms_hh_score_right", label:"Bowing to Buddha Score — Right (0–3)", type:"scale", min:0, max:3 },
        { id:"bms_hh_compensations", label:"Compensations observed", type:"textarea",
          failNotes:"COMMON COMPENSATIONS:\n• Can't lift up: Inactive glutes (weakness or anterior pelvic tilt). Evaluate for structural anomalies or hip misalignment.\n• Poor depth: Tight quads limiting knee bend in lead leg starting position.\n• Stop in the middle: Sudden pause going up or down = instability.\n• Twisting on the way up or down: Sign of pelvic twist. Consider hip assessment.\n• Crashing down: Deficiency in descent control. Should be deliberate and controlled with gentle landing." },
        { id:"bms_hh_notes", label:"Hip hinge notes", type:"textarea" },
      ]},
      { id:"bms_pushup", title:"5. Stiff Core Pushup — Push & Bend Pattern", fields:[
        { id:"bms_pu_score", label:"Stiff Core Pushup Score (0–3)", type:"scale", min:0, max:3,
          failNotes:"SCORING:\nMEN:\n• 3 Points: Body lifts as one unit, no rotation, no spine lag — thumbs aligned with TOP OF HEAD.\n• 2 Points: Same quality — thumbs aligned with BOTTOM OF JAW.\n• 1 Point: Unable to perform or keep torso rigid.\n• 0 Points: Pain ANYWHERE.\n\nWOMEN:\n• 3 Points: Body lifts as one unit, no rotation, no spine lag — thumbs aligned with BOTTOM OF JAW.\n• 2 Points: Same quality — thumbs aligned with COLLARBONE.\n• 1 Point: Unable to perform or keep torso rigid.\n• 0 Points: Pain ANYWHERE.\n\nINSTRUCTIONS:\n1. Lay face down, hands shoulder-width apart, thumbs in line with top of head (men) or jawline (women).\n2. \"Pull toes towards shins, keep knees and elbows lifted off ground.\"\n3. \"Push yourself all the way up and down, moving as one piece, keeping core stiff and straight like an ironing board.\"\n4. 3 reps or until perfect rep. No lag between upper/lower body elevation, no rotation." },
        { id:"bms_pu_compensations", label:"Compensations observed", type:"textarea",
          failNotes:"COMMON COMPENSATIONS:\n• Trunk sag: Poor trunk stability. Consistent core drills — planks, ab wheel rollouts, cable stiff arm pulldowns.\n• Can't push up: Compromised upper body strength. Start with wall pushups, knee pushups on bench, swiss ball pushups.\n• Rotation: Assess for imbalances in shoulder, core, or hips. Apply anti-rotation drills — opposite hand & knee floats, bird dogs, dead bugs.\n• Leads with head: Suboptimal movement strategy, upper crossed syndrome, or forward head posture. Apply posture drills. Demo: empty can test with good head position vs chin tucked down (weakened performance shows importance of neck alignment)." },
        { id:"bms_pu_notes", label:"Pushup notes", type:"textarea" },
      ]},
      { id:"bms_total", title:"BMS-5 Total Score", fields:[
        { id:"bms_total_score", label:"Total BMS-5 Score (sum of all 5 tests, 0–15)", type:"scale", min:0, max:15,
          failNotes:"BMS-5 SCORING GRID — HOW DO YOU MEASURE UP?\n\nMALES:\n          Poor   Below Avg   Avg   Above Avg   Excellent\n18–39:    <10       11        12       13          14\n40–49:     <9       10        11       12          13\n50–59:     <8        9        10       11          12\n60+:       <7        8         9       10          11\n\nFEMALES:\n          Poor   Below Avg   Avg   Above Avg   Excellent\n18–39:    <11       12        13       14          15\n40–49:    <10       11        12       13          14\n50–59:     <9       10        11       12          13\n60+:       <8        9        10       11          12\n\nIMPROVEMENT GOAL:\nConsider applying specific stretch and exercise correctives from the Paddywhack, Revamp, or Sledge Corrective Protocols. Typical improvement rate: 1 point per month. Greater improvements are exceptional. Acknowledge that a plateau may be reached as we approach genetic and/or structural potential." },
        { id:"bms_level", label:"Performance Level", type:"passfail", options:["Poor","Below Average","Average","Above Average","Excellent"] },
        { id:"bms_total_notes", label:"Overall BMS-5 notes & recommendations", type:"textarea" },
      ]},
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
  ALL_ASSESSMENTS.shoulderPosture,
  ALL_ASSESSMENTS.neckSensitivity,
  ALL_ASSESSMENTS.shoulderSensitivity,
  ALL_ASSESSMENTS.speedy6,
  ALL_ASSESSMENTS.speedy7,
  ALL_ASSESSMENTS.bms5,
]
