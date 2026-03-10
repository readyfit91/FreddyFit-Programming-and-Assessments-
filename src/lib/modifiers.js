// ── FIELD MODIFIERS ──────────────────────────────────────────────────────────
// Each key matches a field ID from assessments.js
// When a test is rated ≤7 (fail), the trainer picks a modifier to try in-session.
// "No modifier worked" is always the last option — flags for deeper investigation.

export const FIELD_MODIFIERS = {

  // ═══════════════════════════════════════════════════════════════════════════
  // HYPERMOBILITY ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════
  hm_little_right: [
    'Grip strengthening (squeeze ball 10s hold)',
    'Buddy-tape 4th & 5th fingers during load',
    'Wrist neutral brace during pressing',
    'No modifier worked',
  ],
  hm_little_left: [
    'Grip strengthening (squeeze ball 10s hold)',
    'Buddy-tape 4th & 5th fingers during load',
    'Wrist neutral brace during pressing',
    'No modifier worked',
  ],
  hm_thumb_right: [
    'Thumb stabiliser tape (spica wrap)',
    'Avoid thumb-over grip on bars',
    'Grip cue: knuckles forward, thumb beside index',
    'No modifier worked',
  ],
  hm_thumb_left: [
    'Thumb stabiliser tape (spica wrap)',
    'Avoid thumb-over grip on bars',
    'Grip cue: knuckles forward, thumb beside index',
    'No modifier worked',
  ],
  hm_elbow_right: [
    'Cue: soft elbow lock — stop 5° before full extension',
    'Reduce push-up depth / lock-out range',
    'Elbow sleeve for proprioception',
    'No modifier worked',
  ],
  hm_elbow_left: [
    'Cue: soft elbow lock — stop 5° before full extension',
    'Reduce push-up depth / lock-out range',
    'Elbow sleeve for proprioception',
    'No modifier worked',
  ],
  hm_knee_right: [
    'Cue: micro-bend — never lock knees fully',
    'Posterior chain activation (glute bridge before squats)',
    'Knee sleeve for joint awareness',
    'No modifier worked',
  ],
  hm_knee_left: [
    'Cue: micro-bend — never lock knees fully',
    'Posterior chain activation (glute bridge before squats)',
    'Knee sleeve for joint awareness',
    'No modifier worked',
  ],
  hm_palms: [
    'Hamstring eccentric loading (Romanian deadlift)',
    'Neural flossing (sciatic glide)',
    'Posterior chain warm-up before hinging',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIME 8 FULL BODY
  // ═══════════════════════════════════════════════════════════════════════════
  p8_duck_right: [
    'Hip internal rotation mobilisation (90/90 stretch)',
    'Tibial de-rotation drill',
    'Glute med activation (side-lying clamshell)',
    'Foot arch strengthening (short foot drill)',
    'No modifier worked',
  ],
  p8_duck_left: [
    'Hip internal rotation mobilisation (90/90 stretch)',
    'Tibial de-rotation drill',
    'Glute med activation (side-lying clamshell)',
    'Foot arch strengthening (short foot drill)',
    'No modifier worked',
  ],
  p8_pigeon_right: [
    'Hip external rotation mobilisation',
    'Piriformis stretch (figure 4)',
    'Femoral anteversion check — modify stance width',
    'No modifier worked',
  ],
  p8_pigeon_left: [
    'Hip external rotation mobilisation',
    'Piriformis stretch (figure 4)',
    'Femoral anteversion check — modify stance width',
    'No modifier worked',
  ],
  p8_gas_right: [
    'Ankle dorsiflexion mobilisation (band-assisted)',
    'Calf foam roll + stretch (30s hold)',
    'Heel wedge / elevate heels during squat',
    'Soleus stretch (bent-knee wall lean)',
    'No modifier worked',
  ],
  p8_gas_left: [
    'Ankle dorsiflexion mobilisation (band-assisted)',
    'Calf foam roll + stretch (30s hold)',
    'Heel wedge / elevate heels during squat',
    'Soleus stretch (bent-knee wall lean)',
    'No modifier worked',
  ],
  p8_hip_swing: [
    'Hip flexor release (half-kneeling stretch)',
    'Glute activation (bridge with band)',
    'Adductor rock-back mobilisation',
    'Core bracing drill (dead bug)',
    'No modifier worked',
  ],
  p8_hip_swing_side: [
    'Targeted mobilisation on restricted side',
    'Unilateral glute activation on weaker side',
    'Cross-body adductor stretch',
    'No modifier worked',
  ],
  p8_kneecap: [
    'VMO activation (terminal knee extension)',
    'Patella mobilisation (lateral glide)',
    'Quad foam roll above kneecap',
    'Step-down eccentric loading',
    'No modifier worked',
  ],
  p8_kneecap_side: [
    'Unilateral VMO drill on affected side',
    'Patella taping (McConnell tape)',
    'ITB foam roll on affected side',
    'No modifier worked',
  ],
  p8_empty_can: [
    'Rotator cuff warm-up (band external rotation)',
    'Scapular setting drill (wall slides)',
    'Reduce load and retest',
    'King Atlas neck position reset then retest',
    'No modifier worked',
  ],
  p8_empty_can_side: [
    'Targeted rotator cuff activation on affected side',
    'Scapula retraction + depression cue',
    'Thoracic extension mobilisation',
    'No modifier worked',
  ],
  p8_neck_rotation: [
    'Cervical SNAG mobilisation (if trained)',
    'Upper trap release (pressure point)',
    'Levator scapulae stretch',
    'Chin tuck + rotate retest',
    'No modifier worked',
  ],
  p8_neck_side: [
    'Targeted upper trap release on restricted side',
    'SCM stretch on restricted side',
    'Scalene release on restricted side',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // NECK & SHOULDER GAUNTLET
  // ═══════════════════════════════════════════════════════════════════════════
  ns_hip_swing: [
    'Chin tuck position then retest hip swing',
    'Cervical retraction hold during swing',
    'Upper trap release then retest',
    'No modifier worked',
  ],
  ns_trex: [
    'Cervical retraction (chin tuck) then retest',
    'Neural flossing — radial nerve glide',
    'Forearm extensor stretch + retest',
    'Scalene release then retest',
    'No modifier worked',
  ],
  ns_trex_side: [
    'Targeted nerve glide on affected side',
    'Cervical lateral glide toward affected side',
    'Upper trap release on affected side',
    'No modifier worked',
  ],
  ns_full_can: [
    'Scapular setting (retract + depress) then retest',
    'Thoracic extension mobilisation then retest',
    'Rotator cuff warm-up (band ER) then retest',
    'No modifier worked',
  ],
  ns_full_can_side: [
    'Scapula wall slide on affected side',
    'Targeted ER activation on affected side',
    'Thoracic rotation toward affected side',
    'No modifier worked',
  ],
  ns_empty_can: [
    'King Atlas neck reset then retest',
    'Scapular retraction cue then retest',
    'Reduce resistance and retest',
    'No modifier worked',
  ],
  ns_empty_can_side: [
    'Targeted supraspinatus activation on affected side',
    'Scapula stabilisation on affected side',
    'Cervical lateral glide then retest',
    'No modifier worked',
  ],
  ns_mental_stress: [
    'Diaphragmatic breathing (5 cycles) then retest',
    'Progressive muscle relaxation (90s)',
    'Guided body scan + retest aggravating movement',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // HIP POSTURE ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════
  h_lateral_tilt: [
    'Glute med activation on dropped side',
    'QL stretch on elevated side',
    'Single-leg stance drill on weaker side',
    'No modifier worked',
  ],
  h_forward_tilt: [
    'Hip flexor stretch (Thomas stretch position)',
    'Posterior pelvic tilt drill (wall press)',
    'Glute bridge with pelvic tilt cue',
    'Dead bug with neutral spine cue',
    'No modifier worked',
  ],
  h_rotation: [
    'Hip 90/90 mobilisation',
    'Piriformis release (ball)',
    'Adductor rock-back stretch',
    'No modifier worked',
  ],
  h_internal_right: [
    '90/90 internal rotation stretch — Right',
    'Prone IR mobilisation with overpressure — Right',
    'Hip capsule mobilisation (band distraction) — Right',
    'No modifier worked',
  ],
  h_internal_left: [
    '90/90 internal rotation stretch — Left',
    'Prone IR mobilisation with overpressure — Left',
    'Hip capsule mobilisation (band distraction) — Left',
    'No modifier worked',
  ],
  h_external_right: [
    'Figure 4 stretch — Right',
    'Prone ER mobilisation — Right',
    'Hip capsule posterior glide — Right',
    'No modifier worked',
  ],
  h_external_left: [
    'Figure 4 stretch — Left',
    'Prone ER mobilisation — Left',
    'Hip capsule posterior glide — Left',
    'No modifier worked',
  ],
  h_faber_right: [
    'SI joint mobilisation — Right',
    'Glute stretch + adductor release — Right',
    'Hip capsule distraction (band) — Right',
    'No modifier worked',
  ],
  h_faber_left: [
    'SI joint mobilisation — Left',
    'Glute stretch + adductor release — Left',
    'Hip capsule distraction (band) — Left',
    'No modifier worked',
  ],
  h_swing: [
    'Hip flexor release then retest swing',
    'Glute activation (bridge) then retest',
    'Core bracing cue then retest swing',
    'No modifier worked',
  ],
  h_quad_right: [
    'Quad foam roll — Right',
    'Standing quad stretch (30s hold) — Right',
    'Hip flexor half-kneeling stretch — Right',
    'No modifier worked',
  ],
  h_quad_left: [
    'Quad foam roll — Left',
    'Standing quad stretch (30s hold) — Left',
    'Hip flexor half-kneeling stretch — Left',
    'No modifier worked',
  ],
  h_hamstring_right: [
    'Hamstring foam roll — Right',
    'Supine hamstring stretch (strap/towel) — Right',
    'Neural flossing (sciatic glide) — Right',
    'No modifier worked',
  ],
  h_hamstring_left: [
    'Hamstring foam roll — Left',
    'Supine hamstring stretch (strap/towel) — Left',
    'Neural flossing (sciatic glide) — Left',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // KNEE POSTURE ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════
  k_thigh_right: [
    'VMO activation drill — Right',
    'Quad setting exercise — Right',
    'Single-leg press assessment — Right',
    'No modifier worked',
  ],
  k_thigh_left: [
    'VMO activation drill — Left',
    'Quad setting exercise — Left',
    'Single-leg press assessment — Left',
    'No modifier worked',
  ],
  k_height: [
    'Patella mobilisation (superior/inferior glide)',
    'Quad strengthening (terminal knee extension)',
    'Patellar taping for tracking',
    'No modifier worked',
  ],
  k_alignment: [
    'Glute med strengthening (band walks)',
    'Ankle dorsiflexion mobilisation',
    'Foot arch drill (short foot)',
    'Stance width adjustment during squat',
    'No modifier worked',
  ],
  k_bakers: [
    'Gentle knee flexion/extension pumping',
    'Calf compression + elevation',
    'Reduce knee-loading exercises',
    'No modifier worked',
  ],
  k_hyperext: [
    'Cue: soft lock — stop 5° before full extension',
    'Hamstring activation (bridge variation)',
    'Proprioceptive drill (single-leg balance)',
    'No modifier worked',
  ],
  k_flexion: [
    'Quad foam roll + mobilisation',
    'Patella mobilisation (inferior glide)',
    'Wall squat holds at restricted range',
    'No modifier worked',
  ],
  k_patella_press: [
    'Patella mobilisation (medial/lateral glide)',
    'VMO activation (short arc quad)',
    'Quad foam roll above patella',
    'Patella taping (McConnell)',
    'No modifier worked',
  ],
  k_patella_side: [
    'Targeted patella mob on affected side',
    'ITB foam roll on affected side',
    'VMO isolation on affected side',
    'No modifier worked',
  ],
  k_joint_line_medial: [
    'Valgus unloading (lateral wedge)',
    'Adductor stretch + release',
    'Reduce deep squat depth',
    'No modifier worked',
  ],
  k_joint_line_lateral: [
    'Varus unloading (medial wedge)',
    'ITB foam roll + stretch',
    'Reduce lateral loading movements',
    'No modifier worked',
  ],
  k_meniscus_survey: [
    'Avoid deep flexion under load',
    'Modify squat depth (parallel only)',
    'Knee sleeve for compression',
    'No modifier worked',
  ],
  k_salsa: [
    'Avoid rotational knee loading',
    'Strengthen VMO + hamstrings',
    'Reduce closed-chain rotation drills',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOT & ANKLE ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════
  f_toenails: [
    'Recommend podiatry referral',
    'Ensure clean, dry footwear',
    'Avoid barefoot training on shared surfaces',
    'No modifier worked',
  ],
  f_bunion_right: [
    'Toe spacer during training — Right',
    'Wide toe-box shoe recommendation',
    'Big toe mobilisation (flexion/extension) — Right',
    'No modifier worked',
  ],
  f_bunion_left: [
    'Toe spacer during training — Left',
    'Wide toe-box shoe recommendation',
    'Big toe mobilisation (flexion/extension) — Left',
    'No modifier worked',
  ],
  f_mortons_right: [
    'Metatarsal pad placement — Right',
    'Forefoot cushioning insole — Right',
    'Modify single-leg balance surface',
    'No modifier worked',
  ],
  f_mortons_left: [
    'Metatarsal pad placement — Left',
    'Forefoot cushioning insole — Left',
    'Modify single-leg balance surface',
    'No modifier worked',
  ],
  f_hammer_right: [
    'Toe extension stretches — Right',
    'Marble pick-up drill — Right',
    'Toe spacer during training — Right',
    'No modifier worked',
  ],
  f_hammer_left: [
    'Toe extension stretches — Left',
    'Marble pick-up drill — Left',
    'Toe spacer during training — Left',
    'No modifier worked',
  ],
  f_transverse_right: [
    'Short foot drill (arch doming) — Right',
    'Toe splay exercise — Right',
    'Metatarsal pad for arch support',
    'No modifier worked',
  ],
  f_transverse_left: [
    'Short foot drill (arch doming) — Left',
    'Toe splay exercise — Left',
    'Metatarsal pad for arch support',
    'No modifier worked',
  ],
  f_longitudinal_right: [
    'Short foot drill — Right',
    'Arch-strengthening band exercises — Right',
    'Orthotic/insole trial — Right',
    'Towel scrunches — Right',
    'No modifier worked',
  ],
  f_longitudinal_left: [
    'Short foot drill — Left',
    'Arch-strengthening band exercises — Left',
    'Orthotic/insole trial — Left',
    'Towel scrunches — Left',
    'No modifier worked',
  ],
  f_ankle_right: [
    'Ankle mobilisation (band distraction) — Right',
    'Calf release (foam roll) — Right',
    'Single-leg balance with ankle focus — Right',
    'No modifier worked',
  ],
  f_ankle_left: [
    'Ankle mobilisation (band distraction) — Left',
    'Calf release (foam roll) — Left',
    'Single-leg balance with ankle focus — Left',
    'No modifier worked',
  ],
  f_dorsiflexion_right: [
    'Band-assisted ankle dorsiflexion mob — Right',
    'Calf foam roll (gastrocnemius + soleus) — Right',
    'Heel elevate during squat to compensate — Right',
    'Wall-lean dorsiflexion stretch (30s) — Right',
    'No modifier worked',
  ],
  f_dorsiflexion_left: [
    'Band-assisted ankle dorsiflexion mob — Left',
    'Calf foam roll (gastrocnemius + soleus) — Left',
    'Heel elevate during squat to compensate — Left',
    'Wall-lean dorsiflexion stretch (30s) — Left',
    'No modifier worked',
  ],
  f_heel_raise: [
    'Calf eccentric loading (slow lower)',
    'Ankle stability drill (wobble board)',
    'Toe raise + heel raise superset',
    'No modifier worked',
  ],
  f_balance: [
    'Proprioceptive progression (firm → foam surface)',
    'Ankle stability band work',
    'Single-leg stance drill (eyes open first)',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // STRUCTURAL ANOMALIES
  // ═══════════════════════════════════════════════════════════════════════════
  st_tibial: [
    'Modify foot position during squats (toe-out allowed)',
    'Avoid forced parallel stance',
    'Tibial rotation awareness drill',
    'No modifier worked',
  ],
  st_hip_height: [
    'Heel lift trial on short side',
    'Seated pelvic level check with wedge',
    'Unilateral loading assessment',
    'No modifier worked',
  ],
  st_leg_asymmetry: [
    'Heel lift trial on shorter side',
    'Unilateral exercise prescription',
    'Modify bilateral stance width',
    'No modifier worked',
  ],
  st_leg_length_right: [
    'Heel lift trial — Right',
    'Unilateral loading assessment — Right',
    'Gait analysis with/without lift',
    'No modifier worked',
  ],
  st_leg_length_left: [
    'Heel lift trial — Left',
    'Unilateral loading assessment — Left',
    'Gait analysis with/without lift',
    'No modifier worked',
  ],
  st_scoliosis: [
    'Thoracic extension mobilisation',
    'Unilateral strengthening on concave side',
    'Core stabilisation (anti-rotation focus)',
    'Refer for imaging if moderate/severe',
    'No modifier worked',
  ],
  st_wsit: [
    'Hip ER strengthening (clamshells)',
    'Avoid deep internal rotation under load',
    'Modify squat stance to accommodate anteversion',
    'No modifier worked',
  ],
  st_yogasit: [
    'Hip IR mobilisation (90/90 drill)',
    'Adductor stretch + release',
    'Modify seated positions during training',
    'No modifier worked',
  ],
  st_referral: [
    'Schedule GP / orthopaedic referral',
    'Provide assessment summary for referring practitioner',
    'Modify training to pain-free movements only',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // NECK POSTURE & FUNCTION
  // ═══════════════════════════════════════════════════════════════════════════
  np_curve: [
    'Chin tuck drill (deep cervical flexor activation)',
    'Thoracic extension foam roll',
    'Cervical retraction + hold (10s × 5)',
    'No modifier worked',
  ],
  np_thoracic: [
    'Thoracic extension over foam roller',
    'Cat-cow thoracic focus',
    'Pec stretch (doorway) + thoracic rotation',
    'No modifier worked',
  ],
  np_fhp: [
    'Chin tuck (cervical retraction) × 10',
    'Deep cervical flexor endurance hold',
    'Upper trap + levator scapulae stretch',
    'Wall angel posture drill',
    'No modifier worked',
  ],
  np_empty_can: [
    'King Atlas position (cervical retraction) then retest',
    'Scapular setting + retest',
    'Reduce resistance and retest',
    'No modifier worked',
  ],
  np_hip_swing_neck: [
    'Cervical retraction during hip swing',
    'Upper trap release then retest',
    'Chin tuck + hip swing combined drill',
    'No modifier worked',
  ],
  np_upward_rotation: [
    'Serratus anterior wall press activation',
    'Scapula protraction drill (push-up plus)',
    'Thoracic extension then retest',
    'No modifier worked',
  ],
  np_shoulder_abduction: [
    'Cervical retraction then retest abduction',
    'Deltoid isometric activation warm-up',
    'Scapular depression cue then retest',
    'No modifier worked',
  ],
  np_trex_extensor: [
    'Radial nerve glide then retest',
    'Cervical retraction (chin tuck) then retest',
    'Wrist extensor warm-up then retest',
    'Scalene release then retest',
    'No modifier worked',
  ],
  np_trex_flexor: [
    'Median nerve glide then retest',
    'Cervical retraction then retest',
    'Wrist flexor warm-up then retest',
    'Scalene release then retest',
    'No modifier worked',
  ],
  np_finger_flexors: [
    'Ulnar nerve glide then retest',
    'Cervical retraction then retest grip',
    'Grip warm-up (squeeze ball) then retest',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // NECK SENSITIVITY SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  nss_protrusion: [
    'Reduce range of motion (half range)',
    'Slow speed + controlled movement',
    'Chin tuck first, then partial protrusion',
    'No modifier worked',
  ],
  nss_retraction: [
    'Reduce range — partial retraction only',
    'Overpressure removed — active range only',
    'Supine retraction (gravity-assisted)',
    'No modifier worked',
  ],
  nss_flexion: [
    'Reduce range — half flexion only',
    'Seated (supported) flexion',
    'Chin tuck before flexion',
    'No modifier worked',
  ],
  nss_extension: [
    'Reduce range — partial extension',
    'Supported extension (hands behind head)',
    'Thoracic extension first, then cervical',
    'No modifier worked',
  ],
  nss_sidebend_right: [
    'Reduce range — partial side bend',
    'Upper trap release then retest — Right',
    'Contralateral scalene stretch then retest',
    'No modifier worked',
  ],
  nss_sidebend_left: [
    'Reduce range — partial side bend',
    'Upper trap release then retest — Left',
    'Contralateral scalene stretch then retest',
    'No modifier worked',
  ],
  nss_rotation_right: [
    'Reduce range — partial rotation',
    'Cervical retraction then rotate — Right',
    'Upper trap release then retest — Right',
    'No modifier worked',
  ],
  nss_rotation_left: [
    'Reduce range — partial rotation',
    'Cervical retraction then rotate — Left',
    'Upper trap release then retest — Left',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEEDY 6 NECK MOBILITY
  // ═══════════════════════════════════════════════════════════════════════════
  s6_rotation_right: [
    'Upper trap release then retest — Right',
    'Cervical SNAG rotation — Right',
    'SCM stretch then retest — Right',
    'Chin tuck + rotate (combined) — Right',
    'No modifier worked',
  ],
  s6_rotation_left: [
    'Upper trap release then retest — Left',
    'Cervical SNAG rotation — Left',
    'SCM stretch then retest — Left',
    'Chin tuck + rotate (combined) — Left',
    'No modifier worked',
  ],
  s6_protraction: [
    'Suboccipital release then retest',
    'Deep cervical flexor warm-up then retest',
    'Thoracic extension mob then retest protraction',
    'No modifier worked',
  ],
  s6_retraction: [
    'Suboccipital release then retest',
    'Pec stretch (doorway) then retest',
    'Upper trap release then retest',
    'No modifier worked',
  ],
  s6_extension: [
    'Thoracic extension foam roller then retest',
    'Deep cervical flexor activation then retest',
    'Suboccipital release then retest',
    'No modifier worked',
  ],
  s6_flexion: [
    'Upper trap release then retest',
    'Levator scapulae stretch then retest',
    'Suboccipital release then retest',
    'No modifier worked',
  ],
  s6_sidebend_right: [
    'Scalene release — Right then retest',
    'Upper trap stretch — Right then retest',
    'Levator scapulae release — Right then retest',
    'No modifier worked',
  ],
  s6_sidebend_left: [
    'Scalene release — Left then retest',
    'Upper trap stretch — Left then retest',
    'Levator scapulae release — Left then retest',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOULDER POSTURE & FUNCTION
  // ═══════════════════════════════════════════════════════════════════════════
  sp_humerus_right: [
    'External rotation activation (band) — Right',
    'Pec minor release then retest — Right',
    'Posterior capsule stretch — Right',
    'No modifier worked',
  ],
  sp_humerus_left: [
    'External rotation activation (band) — Left',
    'Pec minor release then retest — Left',
    'Posterior capsule stretch — Left',
    'No modifier worked',
  ],
  sp_collarbone: [
    'Upper trap release on elevated side',
    'Pec minor release on depressed side',
    'Thoracic extension mob then recheck',
    'No modifier worked',
  ],
  sp_ac_joint: [
    'Avoid overhead pressing on affected side',
    'Cross-body adduction stretch (modified)',
    'AC joint taping for stability',
    'No modifier worked',
  ],
  sp_ac_side: [
    'Avoid overhead pressing on affected side',
    'Reduce load on affected side during push exercises',
    'Targeted scapular stabilisation on affected side',
    'No modifier worked',
  ],
  sp_carrying_angle: [
    'Modify grip width during pressing',
    'Neutral-grip alternatives for pressing',
    'Elbow sleeve for proprioception',
    'No modifier worked',
  ],
  sp_scapula_position: [
    'Scapular retraction drill (band pull-aparts)',
    'Serratus anterior activation (push-up plus)',
    'Lower trap activation (prone Y-raise)',
    'Pec stretch (doorway) then recheck position',
    'No modifier worked',
  ],
  sp_winging_right: [
    'Serratus anterior wall press — Right',
    'Push-up plus drill — Right emphasis',
    'Scapular stabilisation with band — Right',
    'No modifier worked',
  ],
  sp_winging_left: [
    'Serratus anterior wall press — Left',
    'Push-up plus drill — Left emphasis',
    'Scapular stabilisation with band — Left',
    'No modifier worked',
  ],
  sp_tilting: [
    'Pec minor release (ball or manual)',
    'Lower trap activation (prone Y-raise)',
    'Thoracic extension mobilisation',
    'Scapular posterior tilt drill',
    'No modifier worked',
  ],
  sp_supraspinatus: [
    'Scapular setting then retest empty can',
    'Rotator cuff warm-up (band ER) then retest',
    'Reduce resistance then retest',
    'Cervical retraction then retest',
    'No modifier worked',
  ],
  sp_infraspinatus: [
    'Side-lying ER warm-up then retest',
    'Posterior cuff activation (band ER at 0°)',
    'Scapular retraction cue then retest',
    'No modifier worked',
  ],
  sp_subscapularis: [
    'IR activation warm-up (band) then retest',
    'Pec release then retest IR strength',
    'Belly press drill then retest',
    'No modifier worked',
  ],
  sp_teres_minor: [
    'Prone ER at 90° warm-up then retest',
    'Posterior capsule stretch then retest',
    'Scapular stabilisation then retest',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEEDY 7 SHOULDER MOBILITY
  // ═══════════════════════════════════════════════════════════════════════════
  s7_thoracic_ext: [
    'Foam roller thoracic extension (30s)',
    'Cat-cow with thoracic focus',
    'Pec stretch (doorway) then retest',
    'No modifier worked',
  ],
  s7_flexion_right: [
    'Lat stretch (side bend) — Right then retest',
    'Thoracic extension mob then retest — Right',
    'Pec minor release then retest — Right',
    'Wall slide drill — Right',
    'No modifier worked',
  ],
  s7_flexion_left: [
    'Lat stretch (side bend) — Left then retest',
    'Thoracic extension mob then retest — Left',
    'Pec minor release then retest — Left',
    'Wall slide drill — Left',
    'No modifier worked',
  ],
  s7_extension_right: [
    'Anterior shoulder stretch — Right',
    'Pec release then retest — Right',
    'Scapular retraction drill then retest — Right',
    'No modifier worked',
  ],
  s7_extension_left: [
    'Anterior shoulder stretch — Left',
    'Pec release then retest — Left',
    'Scapular retraction drill then retest — Left',
    'No modifier worked',
  ],
  s7_overhead_right: [
    'Rotator cuff warm-up then retest arc — Right',
    'Subacromial decompression position (retract + depress)',
    'Reduce speed through painful range — Right',
    'No modifier worked',
  ],
  s7_overhead_left: [
    'Rotator cuff warm-up then retest arc — Left',
    'Subacromial decompression position (retract + depress)',
    'Reduce speed through painful range — Left',
    'No modifier worked',
  ],
  s7_horizontal_right: [
    'Posterior capsule stretch — Right then retest',
    'Thoracic rotation mob then retest — Right',
    'Pec release then retest — Right',
    'No modifier worked',
  ],
  s7_horizontal_left: [
    'Posterior capsule stretch — Left then retest',
    'Thoracic rotation mob then retest — Left',
    'Pec release then retest — Left',
    'No modifier worked',
  ],
  s7_internal_right: [
    'Sleeper stretch — Right then retest',
    'Posterior capsule mobilisation — Right',
    'Cross-body adduction stretch — Right',
    'No modifier worked',
  ],
  s7_internal_left: [
    'Sleeper stretch — Left then retest',
    'Posterior capsule mobilisation — Left',
    'Cross-body adduction stretch — Left',
    'No modifier worked',
  ],
  s7_external_right: [
    'Pec stretch (doorway) — Right then retest',
    'Subscapularis release — Right',
    'Anterior capsule stretch — Right',
    'No modifier worked',
  ],
  s7_external_left: [
    'Pec stretch (doorway) — Left then retest',
    'Subscapularis release — Left',
    'Anterior capsule stretch — Left',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOULDER SENSITIVITY SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  ss_supraspinatus_lag: [
    'Scapular setting then retest',
    'Reduce test height (below 90°)',
    'Isometric hold instead of dynamic test',
    'No modifier worked',
  ],
  ss_infraspinatus_lag: [
    'Warm-up ER with band then retest',
    'Reduce test range then retest',
    'Scapular stabilisation then retest',
    'No modifier worked',
  ],
  ss_subscapularis: [
    'IR warm-up with band then retest',
    'Belly press position then retest',
    'Reduce resistance then retest',
    'No modifier worked',
  ],
  ss_ludingtons: [
    'Reduce palpation pressure then retest',
    'Compare bilateral — note asymmetry',
    'Bicep isometric warm-up then retest',
    'No modifier worked',
  ],
  ss_slap: [
    'Scapular stabilisation then retest',
    'Reduce compression force then retest',
    'Modify arm position (less abduction)',
    'No modifier worked',
  ],
  ss_impingement: [
    'Scapular retraction + depression then retest',
    'Thoracic extension mob then retest',
    'Rotator cuff warm-up then retest',
    'Subacromial decompression taping then retest',
    'No modifier worked',
  ],
  ss_painful_arc: [
    'Scapular retraction cue through arc',
    'Slow speed through 60–120° range',
    'External rotation bias during elevation',
    'Reduce load then retest arc',
    'No modifier worked',
  ],
  ss_apprehension: [
    'Scapular stabilisation then retest',
    'Reduce abduction angle then retest',
    'Relocation test (posterior pressure)',
    'No modifier worked',
  ],
}
