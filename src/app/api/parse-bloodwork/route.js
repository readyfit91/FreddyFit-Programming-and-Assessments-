import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PANEL_MARKERS = {
  'CBC with Differential': [
    'WBC','RBC','Hemoglobin','Hematocrit','MCV','MCH','MCHC','RDW','Platelets','MPV',
    'Neutrophil Absolute','Lymphocyte Absolute','Monocyte Absolute','Eosinophil Absolute','Basophils Absolute',
    'Neutrophil %','Lymphocytes %','Monocyte %','Eosinophils %','Basophils %'
  ],
  'Lipid Panel': [
    'Total Cholesterol','HDL','Triglycerides','LDL','Cholesterol/HDL Ratio','Non-HDL'
  ],
  'Comprehensive Metabolic Panel': [
    'Glucose','BUN','Creatinine','eGFR','BUN/Creatinine Ratio','Sodium','Potassium',
    'Chloride','CO2','Calcium','Total Protein','Albumin','Globulin','A/G Ratio',
    'Total Bilirubin','ALT','AST','Alkaline Phosphatase'
  ],
  'Hemoglobin A1C': [
    'HbA1c','Estimated Average Glucose (mg/dL)','Estimated Average Glucose (mmol/L)',
    'Fasting Glucose','Fasting Insulin','HOMA-IR'
  ],
  'Other / Additional': [
    'Testosterone','Free Testosterone','SHBG','DHEA-S','Estradiol','Cortisol',
    'TSH','Free T3','Free T4','Vitamin D','B12','Folate','Iron','TIBC','Ferritin',
    'CRP','Homocysteine','Uric Acid','Omega-3 Index','Magnesium','Zinc',
    'LDH','PSA','GGT','Fibrinogen','Apolipoprotein B','Lp(a)'
  ]
}

const ALL_MARKERS = Object.values(PANEL_MARKERS).flat()

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('pdf')
    const panelName = formData.get('panel') || null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return Response.json({ error: 'Empty file received' }, { status: 400 })
    }

    const base64 = buffer.toString('base64')
    const markerList = panelName && PANEL_MARKERS[panelName]
      ? PANEL_MARKERS[panelName]
      : ALL_MARKERS

    const panelContext = panelName
      ? `This is a ${panelName} lab report. Focus only on extracting these specific markers.`
      : 'This may contain any blood work markers.'

    const cbcInstructions = panelName === 'CBC with Differential' ? `

SPECIAL CBC FORMAT RULES — Quest Diagnostics / MyChart style:
The PDF uses two different layouts depending on the test:

LAYOUT A — Absolute counts (WBC, RBC, Neutrophils absolute, Lymphocytes absolute, etc.):
  The reference range appears as TWO numbers on one line, then the PATIENT VALUE on the very next line.
  Example:
    3.8  10.8       ← reference range (ignore these)
    6.5             ← THIS is the patient value

LAYOUT B — Percentage values and some indices (Neutrophil%, Lymphocyte%, MCV, MCH, MCHC, RDW, MPV):
  The word "Value" appears, then the patient value on the next line.
  Example:
    Value
    77.2            ← THIS is the patient value

UNIT CONVERSIONS — Quest reports absolute differential counts in cells/µL or cells/uL. Convert to K/µL by dividing by 1000:
  - NEUTROPHIL ABSOLUTE: 5018 cells/uL → Neutrophils: 5.018
  - LYMPHOCYTE ABSOLUTE: 1060 cells/uL → Lymphocytes: 1.060
  - MONOCYTE ABSOLUTE: 351 cells/uL → Monocytes: 0.351
  - EOSINOPHIL ABSOLUTE: 39 cells/uL → Eosinophils: 0.039
  - BASOPHILS ABSOLUTE: 33 cells/uL → Basophils: 0.033
  If the value is already small (e.g., WBC=6.5, already in K/µL range), do NOT divide.
  Comma-formatted numbers like 5,018 mean 5018 — strip the comma before dividing: 5,018 → 5018 / 1000 = 5.018.

CBC SYNONYM MAPPINGS:
  "HEMOGLOBIN" or "HGB" → Hemoglobin (already in g/dL — no conversion)
  "HEMATOCRIT" or "HCT" → Hematocrit
  "RDW" or "RDW-CV" or "RED CELL DISTRIBUTION WIDTH" → RDW
  "PLATELETS" or "PLT" → Platelets (Thousand/uL is already K/µL — no conversion)
  "MPV" or "MEAN PLATELET VOLUME" → MPV
  "NEUTROPHIL ABSOLUTE" or "NEUTROPHILS ABSOLUTE" or "NEUT#" → Neutrophil Absolute (convert cells/uL ÷ 1000 → K/µL)
  "LYMPHOCYTE ABSOLUTE" or "LYMPHS ABSOLUTE" or "LYM#" → Lymphocyte Absolute (convert)
  "MONOCYTE ABSOLUTE" or "MONO#" → Monocyte Absolute (convert)
  "EOSINOPHIL ABSOLUTE" or "EOS#" → Eosinophil Absolute (convert)
  "BASOPHILS ABSOLUTE" or "BASO#" → Basophils Absolute (convert)
  "NEUTROPHIL %" or "NEUTROPHIL" (% layout) or "NEUT%" → Neutrophil %
  "LYMPHOCYTES %" or "LYMPHOCYTES" (% layout) or "LYM%" → Lymphocytes %
  "MONOCYTE %" or "MONOCYTE" (% layout) or "MONO%" → Monocyte %
  "EOSINOPHILS %" or "EOSINOPHILS" (% layout) or "EOS%" → Eosinophils %
  "BASOPHILS %" or "BASOPHILS" (% layout) or "BASO%" → Basophils %
  For WBC, RBC: values already in K/µL or M/µL — use directly.` : ''

    const cmpInstructions = panelName === 'Comprehensive Metabolic Panel' ? `

SPECIAL CMP FORMAT RULES — Quest Diagnostics / MyChart style:
Same two layouts as CBC:
LAYOUT A: two reference numbers on one line, patient value on the NEXT line.
  Example: 65  99 (ref range) then 87 (patient value) → Glucose: 87
LAYOUT B: the word "Value" appears, then patient value on next line.
  Example: Value then 101 → eGFR: 101

CMP SYNONYM MAPPINGS:
  "GLUCOSE" or "GLUCOSE, SERUM" → Glucose
  "BUN" or "UREA NITROGEN" or "BLOOD UREA NITROGEN" → BUN
  "CREATININE" or "CREATININE, SERUM" → Creatinine
  "GFR" or "eGFR" or "ESTIMATED GFR" or "EGFR" → eGFR
  "BUN/CREAT RATIO" or "BUN/CREATININE" → BUN/Creatinine Ratio
  "ALBUMIN/GLOBULIN RATIO" or "A/G RATIO" or "AG RATIO" → A/G Ratio
  "BILIRUBIN TOTAL" or "TOTAL BILIRUBIN" or "BILIRUBIN, TOTAL" → Total Bilirubin
  "ALKALINE PHOSPHATASE" or "ALK PHOS" or "ALP" → Alkaline Phosphatase
  "TOTAL PROTEIN" or "PROTEIN, TOTAL" → Total Protein
  If a result says "SEE NOTE" or is missing/cancelled — skip that marker entirely.` : ''

    const a1cInstructions = panelName === 'Hemoglobin A1C' ? `

SPECIAL HbA1c FORMAT RULES — Quest Diagnostics / MyChart style:
The word "Value" appears above the patient value.
  Example: Value then 5.4 → HbA1c: 5.4

HbA1c SYNONYM MAPPINGS:
  "HEMOGLOBIN A1C" or "HBA1C" or "GLYCOHEMOGLOBIN" or "GLYCATED HEMOGLOBIN" → HbA1c
  "ESTIMATED AVERAGE GLUCOSE (MG/DL)" or "ESTIMATED AVERAGE GLUCOSE" with mg/dL unit → Estimated Average Glucose (mg/dL)
  "ESTIMATED AVERAGE GLUCOSE (MMOL/L)" or "ESTIMATED AVERAGE GLUCOSE" with mmol/L unit → Estimated Average Glucose (mmol/L)
  "FASTING GLUCOSE" or "GLUCOSE, FASTING" → Fasting Glucose (only if separately drawn and reported)
  "FASTING INSULIN" or "INSULIN, FASTING" → Fasting Insulin
  "HOMA-IR" or "INSULIN RESISTANCE" → HOMA-IR` : ''

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            }
          },
          {
            type: 'text',
            text: `You are a precise medical lab result transcriber. ${panelContext}

Your ONLY job is to read the patient's actual result values exactly as printed — do not estimate, calculate, or infer anything.

Map each lab result to one of these marker names:
${markerList.join(', ')}

Common lab name synonyms to help you map correctly:
- "CHOLESTEROL" or "TOTAL CHOLESTEROL" → Total Cholesterol
- "LDL CALCULATED" or "LDL-C" or "LDL CHOL" → LDL
- "TRIGLYCERIDE" or "TRIG" → Triglycerides
- "CHOL/HDL RATIO" or "CHOLESTEROL/HDL" or "TOTAL CHOL/HDL" → Cholesterol/HDL Ratio
- "NON-HDL" or "NON HDL CHOLESTEROL" → Non-HDL
- "HEMOGLOBIN A1C" or "GLYCOHEMOGLOBIN" → HbA1c
- "GLUCOSE, SERUM" → Glucose
- "CREATININE, SERUM" → Creatinine
- "BUN" or "UREA NITROGEN" → BUN
${cbcInstructions}${cmpInstructions}${a1cInstructions}

STRICT RULES:
1. Many lab reports show results in a "Value" field — that number is the patient result. Ignore "Normal value", "Reference range", "Desirable range" — those are NOT the patient's result.
2. Copy the result number EXACTLY as it appears — do not round or modify it (except unit conversions described above).
3. NEVER use a reference range number (e.g. "<100", ">50", "4.5-11.0") as a result value.
4. If a test name is ambiguous or doesn't clearly match one of the listed marker names — skip it.
5. If the result is flagged as invalid, cancelled, or missing — skip it.
6. Return ONLY a valid JSON object. No explanation, no markdown, no units in the values.

Correct: {"Total Cholesterol": 170, "HDL": 75, "LDL": 82, "Triglycerides": 46}
Wrong (used reference range): {"LDL": 100}`
          }
        ]
      }]
    })

    const text = response.content?.map(b => b.text || '').join('') || ''
    let markers = {}
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) markers = JSON.parse(match[0])
    } catch {
      return Response.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const count = Object.keys(markers).length
    return Response.json({ markers, count, panel: panelName })
  } catch (error) {
    console.error('parse-bloodwork error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
