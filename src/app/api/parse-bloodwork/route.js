import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PANEL_MARKERS = {
  'CBC with Differential': [
    'WBC','Neutrophils','Lymphocytes','Monocytes','Eosinophils','Basophils',
    'RBC','Hemoglobin','Hematocrit','MCV','MCH','MCHC','Platelets'
  ],
  'Lipid Panel': [
    'Total Cholesterol','LDL','HDL','Triglycerides','Non-HDL','Cholesterol/HDL Ratio'
  ],
  'Comprehensive Metabolic Panel': [
    'Glucose','BUN','Creatinine','eGFR','BUN/Creatinine Ratio','Sodium','Potassium',
    'Chloride','CO2','Calcium','Total Protein','Albumin','Globulin','A/G Ratio',
    'Total Bilirubin','ALT','AST','Alkaline Phosphatase'
  ],
  'Hemoglobin A1C': [
    'HbA1c','Fasting Glucose','Fasting Insulin','HOMA-IR'
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

STRICT RULES:
1. Many lab reports show results in a "Value" field — that number is the patient result. Ignore "Normal value", "Reference range", "Desirable range" — those are NOT the patient's result.
2. Copy the result number EXACTLY as it appears — do not round or modify it.
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
