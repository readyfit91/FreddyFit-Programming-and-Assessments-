// ── FIELD MODIFIERS ──────────────────────────────────────────────────────────
// Each key matches a field ID from assessments.js
// When a test is rated ≤7 (fail), the trainer picks a modifier to try in-session.
// "No modifier worked" is always the last option — flags for deeper investigation.

export const FIELD_MODIFIERS = {

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
  p8_hip_swing_right: [
    'Hip flexor release (half-kneeling stretch)',
    'Glute activation (bridge with band)',
    'Adductor rock-back mobilisation',
    'Core bracing drill (dead bug)',
    'No modifier worked',
  ],
  p8_hip_swing_left: [
    'Hip flexor release (half-kneeling stretch)',
    'Glute activation (bridge with band)',
    'Adductor rock-back mobilisation',
    'Core bracing drill (dead bug)',
    'No modifier worked',
  ],
  p8_kneecap_right: [
    'VMO activation (terminal knee extension)',
    'Patella mobilisation (lateral glide)',
    'Quad foam roll above kneecap',
    'Step-down eccentric loading',
    'No modifier worked',
  ],
  p8_kneecap_left: [
    'VMO activation (terminal knee extension)',
    'Patella mobilisation (lateral glide)',
    'Quad foam roll above kneecap',
    'Step-down eccentric loading',
    'No modifier worked',
  ],
  p8_empty_can_right: [
    'Rotator cuff warm-up (band external rotation)',
    'Scapular setting drill (wall slides)',
    'Reduce load and retest',
    'King Atlas neck position reset then retest',
    'No modifier worked',
  ],
  p8_empty_can_left: [
    'Rotator cuff warm-up (band external rotation)',
    'Scapular setting drill (wall slides)',
    'Reduce load and retest',
    'King Atlas neck position reset then retest',
    'No modifier worked',
  ],
  p8_neck_rotation_right: [
    'Cervical SNAG mobilisation (if trained)',
    'Upper trap release (pressure point)',
    'Levator scapulae stretch',
    'Chin tuck + rotate retest',
    'No modifier worked',
  ],
  p8_neck_rotation_left: [
    'Cervical SNAG mobilisation (if trained)',
    'Upper trap release (pressure point)',
    'Levator scapulae stretch',
    'Chin tuck + rotate retest',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // NECK & SHOULDER GAUNTLET
  // ═══════════════════════════════════════════════════════════════════════════
  ns_hip_swing_right: [
    'Chin tuck position then retest hip swing',
    'Cervical retraction hold during swing',
    'Upper trap release then retest',
    'No modifier worked',
  ],
  ns_hip_swing_left: [
    'Chin tuck position then retest hip swing',
    'Cervical retraction hold during swing',
    'Upper trap release then retest',
    'No modifier worked',
  ],
  ns_trex_right: [
    'Cervical retraction (chin tuck) then retest',
    'Neural flossing — radial nerve glide',
    'Forearm extensor stretch + retest',
    'Scalene release then retest',
    'No modifier worked',
  ],
  ns_trex_left: [
    'Cervical retraction (chin tuck) then retest',
    'Neural flossing — radial nerve glide',
    'Forearm extensor stretch + retest',
    'Scalene release then retest',
    'No modifier worked',
  ],
  ns_full_can_right: [
    'Scapular setting (retract + depress) then retest',
    'Thoracic extension mobilisation then retest',
    'Rotator cuff warm-up (band ER) then retest',
    'No modifier worked',
  ],
  ns_full_can_left: [
    'Scapular setting (retract + depress) then retest',
    'Thoracic extension mobilisation then retest',
    'Rotator cuff warm-up (band ER) then retest',
    'No modifier worked',
  ],
  ns_empty_can_right: [
    'King Atlas neck reset then retest',
    'Scapular retraction cue then retest',
    'Reduce resistance and retest',
    'No modifier worked',
  ],
  ns_empty_can_left: [
    'King Atlas neck reset then retest',
    'Scapular retraction cue then retest',
    'Reduce resistance and retest',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // KNEE POSTURE ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════
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
  // ═══════════════════════════════════════════════════════════════════════════
  // STRUCTURAL ANOMALIES
  // ═══════════════════════════════════════════════════════════════════════════
  st_tibial: [
    'Modify foot position during squats (toe-out allowed)',
    'Avoid forced parallel stance',
    'Tibial rotation awareness drill',
    'No modifier worked',
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // NECK POSTURE & FUNCTION
  // ═══════════════════════════════════════════════════════════════════════════
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
