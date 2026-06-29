import Anthropic from '@anthropic-ai/sdk'
import pdfParse from 'pdf-parse'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MARKER_NAMES = [
  'WBC','Neutrophils','Lymphocytes','Monocytes','Eosinophils','Basophils','RBC','Hemoglobin',
  'Hematocrit','MCV','MCH','MCHC','Platelets',
  'Total Cholesterol','LDL','HDL','Triglycerides','Non-HDL Cholesterol','LDL/HDL Ratio',
  'Glucose','BUN','Creatinine','eGFR','BUN/Creatinine Ratio','Sodium','Potassium','Chloride',
  'CO2','Calcium','Total Protein','Albumin','Globulin','A/G Ratio','Total Bilirubin',
  'ALT','AST','Alkaline Phosphatase',
  'HbA1c','Fasting Glucose','Fasting Insulin','HOMA-IR',
  'Testosterone','Free Testosterone','SHBG','DHEA-S','Estradiol','Cortisol','TSH','Free T3',
  'Free T4','Vitamin D','B12','Folate','Iron','TIBC','Ferritin','CRP','Homocysteine',
  'Uric Acid','Omega-3 Index','Magnesium','Zinc','LDH','PSA','GGT','Fibrinogen',
  'Apolipoprotein B','Lp(a)'
]

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('pdf')
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    let rawText = ''
    try {
      const parsed = await pdfParse(buffer)
      rawText = parsed.text
    } catch (e) {
      return Response.json({ error: 'Could not read PDF: ' + e.message }, { status: 400 })
    }

    if (!rawText.trim()) {
      return Response.json({ error: 'PDF appears to be a scanned image. Please upload a text-based PDF from your lab.' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a medical lab result parser. Extract blood work values from the following lab report and return ONLY a valid JSON object.

Use exactly these marker names where found (match by common lab abbreviations and synonyms):
${MARKER_NAMES.join(', ')}

Rules:
- Only include markers that appear in the report with a clear numeric result
- Use the exact marker name from the list above
- Values must be numeric only (no units, flags, or ranges)
- If a marker appears multiple times, use the most recent value
- Return ONLY the JSON object, no explanation or markdown

Lab Report Text:
${rawText.slice(0, 10000)}`
      }]
    })

    const text = response.content?.map(b => b.text || '').join('') || ''
    let markers = {}
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) markers = JSON.parse(match[0])
    } catch {
      return Response.json({ error: 'Could not parse AI response into markers' }, { status: 500 })
    }

    const count = Object.keys(markers).length
    return Response.json({ markers, count, textLength: rawText.length })
  } catch (error) {
    console.error('parse-bloodwork error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
