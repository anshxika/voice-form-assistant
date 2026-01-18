import { Hono } from "hono";
import { jsPDF } from "jspdf";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Form fields definition
const formFields = [
  { id: 'fullName', question: 'What is your full name?', type: 'text' },
  { id: 'email', question: 'What is your email address?', type: 'email' },
  { id: 'phone', question: 'What is your phone number?', type: 'tel' },
  { id: 'address', question: 'What is your residential address?', type: 'text' },
  { id: 'dateOfBirth', question: 'What is your date of birth?', type: 'date' },
  { id: 'occupation', question: 'What is your occupation?', type: 'text' }
];

// In-memory form storage (for prototype)
const formSessions = new Map();

// Helper function to extract structured data from spoken answers
async function extractStructuredData(answer: string, fieldType: string, language: string): Promise<string> {
  // Mock AI extraction logic - in production, this would use Cloudflare Workers AI
  // For now, we'll do basic pattern matching and normalization
  
  answer = answer.toLowerCase().trim();
  
  switch (fieldType) {
    case 'email':
      // Extract email pattern
      const emailMatch = answer.match(/[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/i);
      if (emailMatch) {
        return emailMatch[0].toLowerCase();
      }
      // Handle spoken email patterns like "my email is john at gmail dot com"
      const emailWords = answer.split(' ');
      if (emailWords.includes('email') || emailWords.includes('e-mail')) {
        // Simple email reconstruction
        const reconstructed = answer.replace(/[^a-zA-Z0-9@._-]/g, '');
        return reconstructed.includes('@') ? reconstructed : `${reconstructed}@gmail.com`;
      }
      return answer;
      
    case 'tel':
      // Extract phone number patterns
      const phoneMatch = answer.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) {
        return phoneMatch[0].replace(/[^0-9+]/g, '');
      }
      // Extract digits from spoken answer
      const digits = answer.replace(/[^0-9]/g, '');
      if (digits.length >= 10) {
        return digits.length === 10 ? digits : `+${digits}`;
      }
      return answer;
      
    case 'date':
      // Extract date patterns
      const dateMatch = answer.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
      if (dateMatch) {
        return dateMatch[0];
      }
      // Handle spoken dates like "January 15 1990"
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                     'july', 'august', 'september', 'october', 'november', 'december'];
      const monthWords = answer.split(' ').filter(word => months.includes(word));
      if (monthWords.length > 0) {
        // Simple date normalization - in production would use AI
        return answer; // Return as-is for now
      }
      return answer;
      
    default:
      // For text fields, just clean up and return
      return answer.charAt(0).toUpperCase() + answer.slice(1);
  }
}

// Helper function to translate text (mock implementation)
async function translateText(text: string, targetLanguage: string): Promise<string> {
  // Mock translation - in production would use AI4Bharat or similar service
  const translations: { [key: string]: { [key: string]: string } } = {
    'hi': {
      'What is your full name?': 'आपका पूरा नाम क्या है?',
      'What is your email address?': 'आपका ईमेल पता क्या है?',
      'What is your phone number?': 'आपका फोन नंबर क्या है?',
      'What is your residential address?': 'आपका पता क्या है?',
      'What is your date of birth?': 'आपकी जन्म तिथि क्या है?',
      'What is your occupation?': 'आपका पेशा क्या है?',
      'Form completed successfully! You can now download your PDF.': 'फॉर्म सफलतापूर्वक पूरा हो गया है! अब आप अपना PDF डाउनलोड कर सकते हैं।',
      'Form Filled Successfully': 'फॉर्म सफलतापूर्वक भरा गया',
      'Your form has been filled with your voice responses.': 'आपका फॉर्म आपके आवाज़ उत्तरों से भर दिया गया है।',
      'Download PDF': 'PDF डाउनलोड करें',
      'Start New Form': 'नया फॉर्म शुरू करें'
    },
    'bn': {
      'What is your full name?': 'আপনার পূর্ণ নাম কী?',
      'What is your email address?': 'আপনার ইমেল ঠিকানা কী?',
      'What is your phone number?': 'আপনার ফোন নম্বর কী?',
      'What is your residential address?': 'আপনার আবাসিক ঠিকানা কী?',
      'What is your date of birth?': 'আপনার জন্ম তারিখ কী?',
      'What is your occupation?': 'আপনার পেশা কী?',
      'Form completed successfully! You can now download your PDF.': 'ফর্ম সফলভাবে সম্পন্ন হয়েছে! এখন আপনি আপনার PDF ডাউনলোড করতে পারেন।',
      'Form Filled Successfully': 'ফর্ম সফলভাবে পূরণ করা হয়েছে',
      'Your form has been filled with your voice responses.': 'আপনার ফর্মটি আপনার কণ্ঠস্বরের উত্তর দিয়ে পূরণ করা হয়েছে।',
      'Download PDF': 'PDF ডাউনলোড করুন',
      'Start New Form': 'নতুন ফর্ম শুরু করুন'
    },
    'te': {
      'What is your full name?': 'మీ పూర్తి పేరు ఏమిటి?',
      'What is your email address?': 'మీ ఇమెయిల్ చిరునామా ఏమిటి?',
      'What is your phone number?': 'మీ ఫోన్ నంబర్ ఏమిటి?',
      'What is your residential address?': 'మీ నివాస చిరునామా ఏమిటి?',
      'What is your date of birth?': 'మీ పుట్టిన తేదీ ఏమిటి?',
      'What is your occupation?': 'మీ వృత్తి ఏమిటి?',
      'Form completed successfully! You can now download your PDF.': 'ఫారమ్ విజయవంతంగా పూర్తయింది! ఇప్పుడు మీరు మీ PDFని డౌన్‌లోడ్ చేసుకోవచ్చు.',
      'Form Filled Successfully': 'ఫారమ్ విజయవంతంగా నింపబడింది',
      'Your form has been filled with your voice responses.': 'మీ ఫారమ్ మీ వాయిస్ సమాధానాలతో నింపబడింది.',
      'Download PDF': 'PDF డౌన్‌లోడ్ చేయండి',
      'Start New Form': 'కొత్త ఫారమ్ ప్రారంభించండి'
    }
  };
  
  return translations[targetLanguage]?.[text] || text;
}

// API endpoint to start the form
app.post("/api/start", async (c) => {
  try {
    const { language = 'en' } = await c.req.json();
    
    // Create a new session
    const sessionId = crypto.randomUUID();
    formSessions.set(sessionId, {
      language,
      currentFieldIndex: 0,
      formData: {},
      createdAt: new Date().toISOString()
    });
    
    // Get the first question and translate it
    const firstField = formFields[0];
    const translatedQuestion = await translateText(firstField.question, language);
    
    return c.json({
      success: true,
      sessionId,
      question: translatedQuestion,
      originalQuestion: firstField.question,
      fieldId: firstField.id,
      fieldType: firstField.type,
      fieldIndex: 0,
      totalFields: formFields.length
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to start form' }, 500);
  }
});

// API endpoint to process answers
app.post("/api/answer", async (c) => {
  try {
    const { answer, language = 'en', field, fieldType } = await c.req.json();
    
    if (!answer || !field) {
      return c.json({ success: false, error: 'Missing required parameters' }, 400);
    }
    
    // Extract and normalize the data
    const extractedValue = await extractStructuredData(answer, fieldType, language);
    
    return c.json({
      success: true,
      value: extractedValue,
      original: answer,
      field: field
    });
  } catch (error) {
    console.error('Error processing answer:', error);
    return c.json({ success: false, error: 'Failed to process answer' }, 500);
  }
});

// API endpoint to translate text
app.post("/api/translate", async (c) => {
  try {
    const { text, language = 'en' } = await c.req.json();
    
    if (!text) {
      return c.json({ success: false, error: 'No text provided' }, 400);
    }
    
    const translatedText = await translateText(text, language);
    
    return c.json({
      success: true,
      originalText: text,
      translatedText: translatedText,
      language: language
    });
  } catch (error) {
    console.error('Error translating text:', error);
    return c.json({ success: false, error: 'Failed to translate text' }, 500);
  }
});

// API endpoint to generate PDF
app.post("/api/generate-pdf", async (c) => {
  try {
    const { formData, language = 'en' } = await c.req.json();
    
    if (!formData) {
      return c.json({ success: false, error: 'No form data provided' }, 400);
    }
    
    // Create a new PDF document
    const doc = new jsPDF();
    
    // Set font for better Unicode support
    doc.setFont("helvetica");
    
    // Add title
    doc.setFontSize(20);
    doc.text("Draft Form - Generated by AI Assistant", 105, 20, { align: "center" });
    
    // Add generation date
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 30, { align: "center" });
    
    // Add form fields
    let yPosition = 50;
    doc.setFontSize(14);
    
    formFields.forEach(field => {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Field label
      doc.setFont(undefined, "bold");
      doc.text(field.question, 20, yPosition);
      
      // Field value
      doc.setFont(undefined, "normal");
      const value = formData[field.id] || 'Not provided';
      doc.setFontSize(12);
      
      // Handle long text by wrapping
      const lines = doc.splitTextToSize(value, 170);
      doc.text(lines, 20, yPosition + 7);
      
      // Update position for next field
      yPosition += 7 + (lines.length * 5) + 10;
      doc.setFontSize(14);
    });
    
    // Add footer
    const finalYPosition = yPosition + 10;
    if (finalYPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(10);
    doc.setFont(undefined, "italic");
    doc.text("This form was automatically filled using AI Voice Assistant technology.", 105, finalYPosition, { align: "center" });
    doc.text(`Language: ${language} | Please review all information for accuracy.`, 105, finalYPosition + 7, { align: "center" });
    
    // Generate PDF as buffer
    const pdfBuffer = doc.output('arraybuffer');
    
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="filled-form.pdf"'
      }
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    return c.json({ success: false, error: 'Failed to generate PDF' }, 500);
  }
});

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get form structure endpoint
app.get("/api/form-structure", (c) => {
  return c.json({
    success: true,
    fields: formFields.map(field => ({
      id: field.id,
      question: field.question,
      type: field.type
    }))
  });
});

// Upload form endpoint
app.post("/api/upload-form", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    // Check file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ success: false, error: 'Invalid file type. Please upload PDF, JPG, PNG, or DOC files.' }, 400);
    }

    // Read file content
    const fileBuffer = await file.arrayBuffer();
    const fileContent = new Uint8Array(fileBuffer);

    // Mock form field extraction - in production, would use OCR and AI parsing
    let extractedFields = [];
    
    if (file.type === 'application/pdf' || file.type.includes('image/')) {
      // For PDFs and images, simulate OCR extraction
      extractedFields = [
        { id: 'fullName', question: 'Full Name', type: 'text', required: true },
        { id: 'email', question: 'Email Address', type: 'email', required: true },
        { id: 'phone', question: 'Phone Number', type: 'tel', required: false },
        { id: 'address', question: 'Address', type: 'text', required: false },
        { id: 'signature', question: 'Signature', type: 'signature', required: true },
        { id: 'date', question: 'Date', type: 'date', required: false }
      ];
    } else if (file.type.includes('word')) {
      // For Word documents, simulate document parsing
      extractedFields = [
        { id: 'applicantName', question: 'Applicant Name', type: 'text', required: true },
        { id: 'idNumber', question: 'ID Number', type: 'text', required: true },
        { id: 'contact', question: 'Contact Number', type: 'tel', required: true },
        { id: 'email', question: 'Email', type: 'email', required: false },
        { id: 'reference', question: 'Reference Number', type: 'text', required: false }
      ];
    }

    // Create a new session for the uploaded form
    const sessionId = crypto.randomUUID();
    formSessions.set(sessionId, {
      language: 'en',
      currentFieldIndex: 0,
      formData: {},
      uploadedFormFields: extractedFields,
      fileName: file.name,
      fileType: file.type,
      createdAt: new Date().toISOString()
    });

    return c.json({
      success: true,
      sessionId,
      fileName: file.name,
      fileType: file.type,
      extractedFields: extractedFields,
      totalFields: extractedFields.length
    });

  } catch (error) {
    console.error('Error uploading form:', error);
    return c.json({ success: false, error: 'Failed to process uploaded form' }, 500);
  }
});

// Legacy endpoint for compatibility
app.get("/message", (c) => {
  return c.text("Voice Form Assistant is running!");
});

export default app;