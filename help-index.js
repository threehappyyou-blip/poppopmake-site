/* PopPopMake — "Help me find a tool" index.
   Data only: what each page does, in the words visitors actually use.
   The matching rules live in help-assistant.js; nothing here is sent anywhere.

   HOW TO ADD A TOOL
   1. Add one T(...) line in the right group below (id, name, category, link, one-line
      description, phrases people would type, single keywords).
   2. If the tool lives on a tabbed hub page, the link ends in #<tab id>.
   3. If a request people keep making is now built, delete its G(...) line under "NOT BUILT YET".
   The page /help-me and the Ctrl+K search both read this file. */
(function (root) {
  'use strict';

  var tools = [];
  var gaps = [];

  /* T(id, name, category, link, description, phrases, keywords, extras) */
  function T(id, name, cat, href, desc, does, kw, extra) {
    var e = { id: id, type: 'tool', name: name, cat: cat, href: href, desc: desc,
              does: does || [], kw: kw || [] };
    if (extra) for (var k in extra) e[k] = extra[k];
    tools.push(e);
  }
  /* A(...) = a guide / info page: same as T but ranked below tools unless the question fits. */
  function A(type, id, name, href, desc, does, kw, extra) {
    var e = { id: id, type: type, name: name, cat: type === 'guide' ? 'Guide' : 'Info', href: href, desc: desc,
              does: does || [], kw: kw || [] };
    if (extra) for (var k in extra) e[k] = extra[k];
    tools.push(e);
  }
  /* G(id, label, rule, note) — something people ask for that we do NOT have (yet). */
  function G(id, label, rule, note, near, soft) {
    var g = { id: id, label: label, note: note, near: near || [], soft: !!soft };
    for (var k in rule) g[k] = rule[k];
    gaps.push(g);
  }

  var FONT_WARN = { any: ['korean', 'chinese', 'japanese', 'arabic', 'russian', 'hindi', 'thai', 'emoji', '__nonlatin__'],
    text: 'Heads up: the PDF this tool makes uses a standard font, so Korean, Chinese, Japanese, Arabic, Cyrillic and emoji can’t be printed on it. English and Western European letters work.' };

  /* ------------------------------------------------------------------ DOCUMENTS */
  T('merge-pdf', 'Merge PDFs', 'Documents', '/document-tools#merge',
    'Combine two or more PDFs into one file, in the order you choose.',
    ['merge pdf', 'combine pdf', 'join pdf', 'put pdfs together', 'pdf into one file', 'several pdfs one pdf', 'append pdf', 'add one pdf to another pdf', 'stitch pdf'],
    ['merge', 'combine', 'join', 'append', 'stitch', 'concatenate', 'together'],
    { warn: [{ any: ['password', 'protected', 'encrypted', 'locked'], text: 'Password-protected PDFs are refused (the tool tells you how to make an unprotected copy first).' }] });

  T('split-pdf', 'Split PDF', 'Documents', '/document-tools#split',
    'Pull specific pages out of a PDF into a new file. To delete pages, extract the ones you want to keep.',
    ['split pdf', 'extract pages from pdf', 'pull pages out of a pdf', 'one page of a pdf', 'delete pages from pdf', 'remove pages from pdf', 'keep only some pages of a pdf', 'cut pages out of pdf', 'separate pdf pages', 'divide a pdf', 'save a page as its own pdf', 'take a page from a pdf'],
    ['split', 'extract', 'separate', 'divide', 'page', 'pages', 'cut'],
    { warn: [{ any: ['password', 'protected', 'encrypted', 'locked'], text: 'Password-protected PDFs are refused (the tool tells you how to make an unprotected copy first).' }] });

  T('images-to-pdf', 'Images to PDF', 'Documents', '/document-tools#images',
    'Turn JPG or PNG photos into a single PDF, one image per page.',
    ['image to pdf', 'photo to pdf', 'jpg to pdf', 'png to pdf', 'picture to pdf', 'scan to pdf', 'make a pdf from photos', 'photos into one pdf', 'screenshots to pdf', 'combine images into a pdf', 'camera pictures to pdf', 'turn jpg into pdf'],
    ['jpg', 'jpeg', 'png', 'photo', 'picture', 'image', 'scan']);

  T('file-converter', 'Convert Files', 'Documents', '/document-tools#convert',
    'Change a photo or PDF into another format: HEIC, JPG, PNG, WebP, BMP, TIFF, ICO or PDF. PDF pages become pictures, text or a Word file. One file or a whole batch.',
    ['convert heic to jpg', 'heic to jpg', 'heic to png', 'heic to pdf', 'heic to webp', 'iphone photo to jpg', 'iphone photos wont open on my computer', 'convert iphone pictures', 'open a heic file on windows', 'open heic file',
     'webp to jpg', 'webp to png', 'png to jpg', 'jpg to png', 'jpg to webp', 'png to webp', 'gif to png', 'gif to jpg', 'bmp to jpg', 'bmp to png', 'png to bmp', 'jpg to bmp', 'jpg to tiff', 'png to tiff', 'tiff to jpg', 'tiff to png', 'avif to jpg', 'avif to png',
     'png to ico', 'jpg to ico', 'make a favicon from a png', 'convert image to ico', 'convert image format', 'change image format', 'change file format', 'convert file format', 'convert file type', 'change file type', 'file format converter', 'file converter', 'file conversion', 'convert a file', 'convert files', 'convert my file', 'convert any file', 'batch convert images', 'convert a whole folder of photos',
     'pdf to jpg', 'pdf to png', 'pdf to image', 'pdf to images', 'pdf to picture', 'pdf to webp', 'pdf pages as images', 'save pdf pages as pictures', 'pdf to word', 'pdf to docx', 'pdf to txt', 'save pdf as a text file', 'convert pdf to editable word', 'turn a pdf into a word document'],
    ['convert', 'converter', 'conversion', 'heic', 'heif', 'iphone', 'webp', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'ico', 'favicon', 'avif', 'format', 'docx'],
    { warn: [
      { any: ['word', 'docx', 'editable'], text: 'Heads up: a PDF can be saved as a Word file here, but the Word file keeps the text only (no layout, tables or pictures), and Word files can’t be opened or converted.' },
      { any: ['tiff', 'tif'], text: 'Heads up: TIFF files can be opened only by browsers that support them (Safari); saving as TIFF works everywhere.' },
      { any: ['scan', 'scanned', 'scanner'], text: 'Heads up: a scanned PDF has no text to extract. Use Extract Text (OCR) for that.' }] });

  T('remove-bg', 'Remove Background', 'Documents', '/document-tools#bgremove',
    'Cut the subject out of a photo and leave a transparent background.',
    ['remove background', 'remove background from photo', 'erase background', 'delete background', 'transparent background', 'background remover', 'cut out subject', 'cut out a person', 'product photo background', 'profile picture background', 'make png transparent', 'isolate subject'],
    ['background', 'transparent', 'cutout', 'isolate', 'bg']);

  T('clean-metadata', 'Clean Metadata', 'Documents', '/document-tools#metadata',
    'Strip hidden author, software and date information from a PDF.',
    ['remove metadata from pdf', 'clean pdf metadata', 'strip metadata', 'pdf author name', 'hidden information in pdf', 'pdf properties', 'remove author from pdf', 'pdf creation date', 'pdf creator software', 'anonymize pdf', 'make pdf anonymous', 'hidden info in pdf', 'author info in pdf', 'what is hidden in my pdf'],
    ['metadata', 'author', 'properties', 'xmp', 'producer', 'hidden', 'strip', 'scrub', 'anonymize']);

  T('compress-image', 'Compress & Convert Image', 'Documents', '/document-tools#compress',
    'Shrink a photo’s file size and/or convert it between JPG, PNG and WebP.',
    ['compress image', 'compress photo', 'compress picture', 'reduce image file size', 'make image smaller', 'make photo smaller', 'shrink a picture', 'photo too big to upload', 'image too large for email', 'resize image', 'resize photo', 'optimize image', 'reduce image kb', 'image under 1mb'],
    ['compress', 'resize', 'shrink', 'jpg', 'png', 'webp', 'smaller', 'kb', 'mb', 'quality', 'dimension', 'optimize']);

  T('redact-pdf', 'Redact PDF', 'Documents', '/document-tools#redact',
    'Permanently black out sensitive text in a PDF — by hand or by searching for it.',
    ['redact pdf', 'black out text in pdf', 'black out sensitive information', 'hide social security number', 'hide ssn in document', 'hide account number', 'hide id number', 'hide personal information in pdf', 'censor a pdf', 'cover text in pdf', 'mask information in a document', 'redaction', 'black box over text', 'hide a name in a document', 'blackout pdf', 'cover up my home address on a pdf', 'hide my address in a pdf', 'hide my phone number in a document', 'cover up personal details', 'hide private details before sharing'],
    ['redact', 'blackout', 'censor', 'mask', 'sensitive', 'confidential', 'ssn', 'private', 'cover', 'conceal'],
    { warn: [{ any: ['password', 'protected', 'encrypted', 'locked'], text: 'Password-protected PDFs are refused (the tool tells you how to make an unprotected copy first).' }] });

  T('ocr', 'Extract Text (OCR)', 'Documents', '/document-tools#ocr',
    'Read the text in a photo, scanned page, screenshot or PDF so you can copy it.',
    ['extract text from image', 'text from a screenshot', 'text from photo', 'image to text', 'scan to text', 'scanned pdf to text', 'pdf to text', 'ocr', 'copy text from a picture', 'read text in an image', 'convert image to text', 'digitize a document', 'handwriting to text', 'recognize text', 'grab text from pdf', 'make scanned pdf copyable'],
    ['ocr', 'extract', 'scan', 'scanned', 'recognize', 'digitize', 'handwriting', 'tesseract'],
    { warn: [{ any: ['pdf'], text: 'Tip: if the PDF is a normal one (not a scan), Convert Files can save its text as a .txt file right away, with no OCR.' }] });

  T('face-mosaic', 'Face Mosaic', 'Documents', '/document-tools#facemosaic',
    'Find faces in a photo automatically and cover them with a mosaic.',
    ['blur face', 'blur faces in a photo', 'pixelate face', 'hide faces', 'cover a face', 'anonymize faces', 'mosaic a face', 'censor a face', 'blur people in a photo', 'blur childrens faces', 'face blur', 'hide identity in photo', 'blur faces in group photo'],
    ['face', 'faces', 'mosaic', 'pixelate', 'anonymize', 'censor', 'identity']);

  T('enhance-quality', 'Enhance Quality', 'Documents', '/document-tools#upscale',
    'Sharpen and enlarge a soft, blurry or low-resolution photo.',
    ['enhance photo quality', 'improve image quality', 'upscale image', 'increase resolution', 'make image bigger without losing quality', 'make a photo sharper', 'unblur a photo', 'fix a blurry photo', 'sharpen image', 'low resolution to high resolution', 'enlarge an image', 'hd photo', 'upscale 2x 4x', 'restore old photo', 'make picture clearer', 'pixelated photo', 'fix a pixelated image', 'tiny blurry photo', 'low quality photo'],
    ['upscale', 'enhance', 'sharpen', 'resolution', 'blurry', 'enlarge', 'hd', '4k', 'clearer', 'pixelated', 'improve', 'sharper', 'unblur']);

  T('ai-eraser', 'AI Eraser', 'Documents', '/document-tools#eraser',
    'Paint over an unwanted object or person and let AI fill in the background.',
    ['remove object from photo', 'erase an object from a picture', 'remove person from photo', 'delete a person from a picture', 'remove unwanted object', 'remove a sign from a photo', 'remove photobomber', 'inpaint', 'retouch a photo', 'get rid of something in a photo', 'remove tourist from photo', 'clean up a photo', 'object remover', 'magic eraser', 'remove a stranger from the background of my photo', 'get rid of a person in the background', 'remove power lines from a photo', 'remove wires from a picture', 'remove people from a photo', 'wipe something out of a picture', 'remove text from a picture'],
    ['erase', 'eraser', 'inpaint', 'retouch', 'object', 'unwanted', 'photobomb', 'person', 'people', 'wire', 'wires']);

  T('screenshot-markup', 'Screenshot Markup', 'Documents', '/screenshot-markup',
    'Annotate a screenshot with arrows, shapes, text and highlights — or crop and blur an area.',
    ['annotate a screenshot', 'markup screenshot', 'draw arrow on screenshot', 'add arrows to an image', 'add text to an image', 'highlight part of a screenshot', 'crop a screenshot', 'crop an image', 'crop a photo', 'blur part of a screenshot', 'blur out information in a screenshot', 'blur a license plate', 'circle something in a screenshot', 'draw on an image', 'mark up an image', 'write on a photo', 'hide info in a screenshot'],
    ['screenshot', 'annotate', 'markup', 'arrow', 'highlight', 'crop', 'draw', 'shape', 'blur', 'capture', 'callout']);

  /* ------------------------------------------------------------------ MONEY & TAX */
  T('paycheck-us', 'Paycheck Calculator (US)', 'Money & Tax', '/paycheck-calculator',
    'Take-home pay after federal tax, FICA and state tax — all 50 states and D.C.',
    ['paycheck calculator', 'take home pay', 'net pay', 'salary after tax', 'hourly pay after tax', 'how much will i take home', 'income after taxes', 'gross to net', 'paycheck after taxes', 'pay stub estimate', 'federal income tax on my salary', 'fica', 'social security and medicare tax', 'overtime pay after tax', 'tax on my bonus', 'withholding estimate', 'what is my net salary', 'payroll calculator', 'weekly pay after tax', 'biweekly paycheck', 'monthly take home', 'how much tax will i pay on my salary', 'what will i earn after taxes', 'annual salary to net', 'wages after tax', 'salary calculator', 'overtime pay', 'overtime calculator', 'bonus tax', 'bonus calculator', 'how much will i get paid', 'how much do i get paid per month', 'monthly pay from a salary', 'what will i actually get paid'],
    ['paycheck', 'takehome', 'net', 'gross', 'withholding', 'fica', 'salary', 'wage', 'hourly', 'overtime', 'bonus', 'payroll', 'payslip', 'paystub', 'income', 'pay'],
    { prior: 0.4 });

  T('paycheck-states', 'Paycheck Calculator by State', 'Money & Tax', '/paycheck-states',
    'A directory of all 50 states and D.C., each with its own paycheck calculator.',
    ['paycheck by state', 'state paycheck calculator', 'state income tax', 'which states have no income tax', 'no income tax states', 'tax by state', 'state tax rates', 'pick a state paycheck calculator', 'every state paycheck calculator', 'all states take home'],
    ['state', 'states', 'directory'],
    { prior: 0.1 });

  T('paycheck-uk', 'UK Paycheck Calculator', 'Money & Tax', '/uk-paycheck-calculator',
    'Take-home pay after Income Tax and National Insurance — England, Wales, NI or Scotland (2026/27).',
    ['uk paycheck', 'uk take home pay', 'uk salary after tax', 'national insurance', 'income tax uk', 'scottish income tax', 'england wales northern ireland tax', 'uk payslip', 'paye calculator', 'net salary uk', 'gbp salary after tax', 'british take home pay'],
    ['uk', 'britain', 'british', 'england', 'scotland', 'scottish', 'wales', 'london', 'hmrc', 'paye', 'gbp', 'pound', 'nhs']);

  T('paycheck-au', 'Australia Paycheck Calculator', 'Money & Tax', '/au-paycheck-calculator',
    'Take-home pay after income tax, LITO and the Medicare levy (2026-27).',
    ['australia paycheck', 'australian take home pay', 'australian salary after tax', 'medicare levy', 'low income tax offset', 'ato tax', 'aud salary after tax', 'net pay australia', 'sydney salary after tax', 'melbourne take home pay'],
    ['australia', 'australian', 'aussie', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'ato', 'aud', 'lito', 'medicare']);

  T('paycheck-ca', 'Canada Paycheck Calculator', 'Money & Tax', '/ca-paycheck-calculator',
    'Take-home pay after federal and provincial tax, CPP/QPP and EI (2026).',
    ['canada paycheck', 'canadian take home pay', 'canadian salary after tax', 'cpp and ei', 'ontario take home pay', 'quebec take home pay', 'bc salary after tax', 'alberta take home pay', 'cra income tax', 'net pay canada', 'cad salary after tax', 'provincial tax', 'british columbia', 'nova scotia', 'new brunswick', 'prince edward island', 'northwest territories', 'newfoundland and labrador'],
    ['canada', 'canadian', 'ca', 'ontario', 'quebec', 'alberta', 'manitoba', 'saskatchewan', 'yukon', 'nunavut', 'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'cpp', 'qpp', 'cra', 'cad', 'ei']);

  T('compare-takehome', 'Compare Take-Home Pay', 'Money & Tax', '/compare-takehome',
    'Put two jobs side by side — any US state, UK, Australia or Canada — and compare take-home pay.',
    ['compare take home pay', 'compare salaries after tax', 'compare job offers', 'compare states salary', 'moving to another state pay', 'relocation take home pay', 'compare countries salary', 'which state pays more after tax', 'texas vs california take home', 'two job offers', 'salary comparison after tax', 'job offer comparison', 'is it worth moving for a higher salary'],
    ['compare', 'comparison', 'versus', 'relocate', 'relocation', 'offer', 'offers'],
    { req: [['compare', 'offer', 'relocate', 'move', 'worth', 'higher', 'better', 'between', 'side', 'difference', 'different']] });

  T('mortgage', 'Mortgage Calculator', 'Money & Tax', '/mortgage-calculator',
    'Full monthly home-loan payment: principal, interest, property tax, insurance, PMI and HOA.',
    ['mortgage calculator', 'monthly mortgage payment', 'home loan payment', 'house payment', 'how much house can i afford', 'home affordability', 'principal and interest', 'pmi', 'property tax and insurance', 'extra mortgage payment', 'pay off mortgage early', 'mortgage interest', 'monthly cost of owning a home', 'down payment', '30 year mortgage', '15 year mortgage', 'hoa fees', 'home loan emi', 'buy a house monthly payment'],
    ['mortgage', 'house', 'pmi', 'hoa', 'escrow', 'downpayment', 'homeowner', 'homeowners', 'property']);

  T('retirement-401k', '401(k) Retirement Calculator', 'Money & Tax', '/retirement-calculator',
    'Project your 401(k) balance from contributions, employer match and growth, using 2026 IRS limits.',
    ['401k calculator', 'retirement calculator', '401k growth', 'how much will my 401k be', 'employer match', '401k contribution limit', '401k catch up contribution', 'retirement savings projection', 'retirement nest egg', 'how much will i have at retirement', 'save for retirement', 'retirement balance at 65', '401k vs salary', 'contribution percentage'],
    ['401k', 'retirement', 'retire', 'match', 'catchup', 'pension', 'nest egg', 'contribution', 'contributions']);

  T('capital-gains', 'Capital Gains Calculator', 'Money & Tax', '/capital-gains-calculator',
    'Estimate federal tax on stock or crypto sales, netting gains and losses like Schedule D.',
    ['capital gains tax', 'tax on selling stock', 'tax when i sell shares', 'crypto tax', 'bitcoin tax', 'short term vs long term gains', 'long term capital gains rate', 'cost basis', 'niit', 'capital loss', 'harvest losses', 'tax on investment profit', 'schedule d', 'how much tax if i sell my stocks', 'tax on selling crypto', 'sold stock at a profit'],
    ['capital', 'gains', 'gain', 'crypto', 'bitcoin', 'stock', 'stocks', 'shares', 'basis', 'niit', 'loss', 'losses', 'etf', 'ethereum']);

  T('debt-payoff', 'Debt Payoff Calculator', 'Money & Tax', '/debt-payoff-calculator',
    'Compare the snowball and avalanche payoff plans for your debts, side by side.',
    ['debt payoff', 'pay off debt', 'debt snowball', 'debt avalanche', 'snowball vs avalanche', 'credit card payoff', 'pay off credit cards', 'how long to pay off my debt', 'get out of debt', 'several debts at once', 'pay off loans faster', 'extra payment on debt', 'debt free date', 'debt payoff plan', 'which debt to pay first'],
    ['debt', 'debts', 'snowball', 'avalanche', 'payoff', 'credit card', 'owe', 'minimum payment']);

  /* ------------------------------------------------------------------ HEALTH */
  T('bmi', 'BMI Calculator', 'Health', '/bmi-calculator',
    'Body mass index and WHO category from height and weight, with optional Asian thresholds.',
    ['bmi calculator', 'body mass index', 'am i overweight', 'am i underweight', 'healthy weight for my height', 'weight category', 'is my weight healthy', 'obesity check', 'bmi chart', 'height and weight check'],
    ['bmi', 'overweight', 'underweight', 'obese', 'obesity']);

  T('calorie', 'Calorie / TDEE Calculator', 'Health', '/calorie-calculator',
    'Daily calories (BMR and TDEE) and targets for losing, keeping or gaining weight.',
    ['calorie calculator', 'daily calories', 'how many calories should i eat', 'calories to lose weight', 'calories to gain weight', 'tdee', 'bmr', 'maintenance calories', 'calorie deficit', 'weight loss calories', 'cutting calories', 'calories to build muscle', 'basal metabolic rate', 'daily energy expenditure', 'how much should i eat to lose weight'],
    ['calorie', 'calories', 'tdee', 'bmr', 'deficit', 'surplus', 'diet', 'metabolism', 'maintenance', 'kcal']);

  /* ------------------------------------------------------------------ CAREER */
  T('resume-builder', 'Resume Builder', 'Career', '/career-tools#builder',
    'Build a clean, single-column, ATS-friendly resume as a PDF.',
    ['resume builder', 'make a resume', 'create a resume', 'resume maker', 'cv maker', 'build my cv', 'resume template', 'resume pdf', 'ats friendly resume', 'resume for a job application', 'curriculum vitae', 'write a resume'],
    ['resume', 'cv', 'curriculum', 'vitae'], { warn: [FONT_WARN] });

  T('ats-checker', 'ATS Score Checker', 'Career', '/career-tools#ats',
    'Compare your resume with a job description and see which keywords are missing.',
    ['ats score', 'ats checker', 'resume keywords', 'resume vs job description', 'does my resume match the job', 'missing keywords in my resume', 'applicant tracking system', 'resume scanner', 'job description keywords', 'tailor my resume to a job', 'check resume against job posting', 'resume score', 'resume match score'],
    ['ats', 'keyword', 'keywords', 'applicant', 'posting', 'tailor'],
    { warn: [{ any: ['korean', 'chinese', 'japanese', 'arabic', 'russian', '__nonlatin__'], text: 'Heads up: the ATS checker reads English text only.' }] });

  T('cover-letter', 'Cover Letter', 'Career', '/career-tools#cover',
    'Assemble a formatted cover-letter PDF from your own answers (it formats; it doesn’t write for you).',
    ['cover letter', 'write a cover letter', 'cover letter generator', 'cover letter template', 'application letter', 'job application letter', 'motivation letter', 'letter for a job application'],
    ['cover', 'letter'], { warn: [FONT_WARN] });

  T('hourly-salary', 'Hourly ↔ Salary Converter', 'Career', '/career-tools#salary',
    'Convert between an hourly wage and an annual salary using your real hours and weeks.',
    ['hourly to salary', 'salary to hourly', 'hourly wage to annual salary', 'annual salary to hourly rate', 'how much is 25 an hour per year', 'what is 60k per hour', 'convert hourly rate to yearly', 'yearly salary to hourly', 'pay per hour', 'wage converter', 'hours per week and weeks per year', 'hourly rate calculator'],
    ['hourly', 'annual', 'yearly', 'wage', 'rate']);

  /* ------------------------------------------------------------------ BUSINESS */
  T('invoice', 'Invoice Generator', 'Business', '/business-tools#invoice',
    'Create a clean invoice PDF, ready to send to a client.',
    ['invoice generator', 'make an invoice', 'create an invoice', 'invoice template', 'bill a client', 'freelance invoice', 'invoice pdf', 'send an invoice', 'invoice maker', 'small business invoice', 'contractor invoice', 'billing a customer'],
    ['invoice', 'invoices', 'billing', 'bill', 'client', 'freelance', 'freelancer', 'contractor'], { warn: [FONT_WARN] });

  T('qr-code', 'QR Code Generator', 'Business', '/business-tools#qr',
    'Turn a link or text into a scannable QR code with your own colors (PNG).',
    ['qr code generator', 'make a qr code', 'qr code for my website', 'qr code for a link', 'qr code for wifi', 'qr code for a menu', 'qr code for a url', 'qr code for text', 'create a qr code', 'custom qr code colors', 'qr code png'],
    ['qr', 'qrcode']);

  /* ------------------------------------------------------------------ WRITING */
  T('ai-cliche-check', 'AI-Cliché Check', 'Writing', '/writing-tools#check',
    'Scan text for stock and AI-sounding phrases (“delve”, “tapestry”) and highlight them.',
    ['ai cliche check', 'check my text for ai phrases', 'does this sound like chatgpt', 'ai sounding words', 'ai writing check', 'flag ai phrases', 'robotic writing', 'sounds like ai', 'ai detector', 'chatgpt detector', 'gpt detector', 'ai content check', 'flagged phrases', 'stock phrases in my writing', 'was this written by ai'],
    ['cliche', 'flagged', 'robotic', 'detector', 'delve', 'tapestry', 'chatgpt', 'gpt', 'ai']);

  T('smooth-it-out', 'Smooth It Out', 'Writing', '/writing-tools#smooth',
    'Get plainer replacements for the stiff or AI-sounding phrases found in your text.',
    ['smooth it out', 'make my writing sound more human', 'make writing more natural', 'make text less robotic', 'humanize text', 'plainer words', 'replace ai phrases', 'simplify wording', 'fix stiff phrases', 'natural tone', 'fix ai sounding text', 'plain language swaps', 'sound less like ai', 'sound more natural', 'read more naturally', 'make text read naturally'],
    ['smooth', 'human', 'humanize', 'natural', 'naturally', 'plain', 'swap', 'simplify']);

  T('word-count', 'Word Count & Readability', 'Writing', '/writing-tools#count',
    'Words, characters, sentences, reading time and a Flesch reading-ease score, live as you type.',
    ['word count', 'word counter', 'character count', 'count characters', 'how many words', 'sentence count', 'reading time', 'readability score', 'flesch reading ease', 'reading level', 'text length', 'paragraph count', 'essay word count', 'character limit', 'count words in my text'],
    ['word', 'words', 'count', 'counter', 'character', 'characters', 'readability', 'flesch', 'sentences', 'paragraphs']);

  /* ------------------------------------------------------------------ EVERYDAY */
  T('age-calc', 'Age Calculator', 'Everyday', '/everyday-tools#age',
    'Exact age in years, months and days — or the time between any two dates.',
    ['age calculator', 'how old am i', 'calculate my age', 'exact age', 'date of birth to age', 'days until my birthday', 'next birthday', 'days between two dates', 'time between two dates', 'how many days between dates', 'how many days since', 'how long ago was', 'difference between two dates', 'date difference', 'years between dates', 'how many days old am i'],
    ['age', 'old', 'birthday', 'birth', 'dob', 'between']);

  T('percentage', 'Percentage Calculator', 'Everyday', '/everyday-tools#pct',
    'What is X% of Y, X is what % of Y, percent change, and increase/decrease by a percentage.',
    ['percentage calculator', 'percent calculator', 'what is 15 percent of', 'percent of a number', 'percent change', 'percentage increase', 'percentage decrease', 'percent off', 'discount calculator', 'x is what percent of y', 'increase a number by a percent', 'decrease a number by a percent', 'price after discount', 'sale price percent off', 'what percent is 45 of 50', 'percent difference'],
    ['percent', 'percentage', 'discount', 'increase', 'decrease']);

  T('tip-split', 'Tip & Split Calculator', 'Everyday', '/everyday-tools#tip',
    'The tip and each person’s share of a restaurant bill, with optional sales tax.',
    ['tip calculator', 'split the bill', 'split a check', 'bill splitter', 'how much to tip', 'tip and split', 'dinner bill split', 'restaurant tip', 'gratuity', 'divide the bill among friends', 'tip on total or subtotal', '18 20 percent tip', 'split a restaurant bill'],
    ['tip', 'split', 'gratuity', 'restaurant', 'dinner', 'dutch']);

  T('password-gen', 'Password Generator', 'Everyday', '/everyday-tools#pwd',
    'Make a random password (6–64 characters) in your browser — nothing is sent anywhere.',
    ['password generator', 'generate a password', 'random password', 'strong password', 'secure password', 'create a password', 'make me a password', 'new password'],
    ['password', 'passwords']);

  T('unit-convert', 'Unit Converter', 'Everyday', '/everyday-tools#unit',
    'Height, weight, temperature, distance and volume between metric and US units.',
    ['unit converter', 'convert units', 'pounds to kg', 'kg to pounds', 'feet to cm', 'cm to feet and inches', 'inches to cm', 'celsius to fahrenheit', 'fahrenheit to celsius', 'miles to km', 'km to miles', 'gallons to liters', 'liters to gallons', 'metric to imperial', 'imperial to metric', 'convert height', 'convert weight', 'convert temperature', 'lbs to kg', 'stone to kg'],
    ['unit', 'units', 'metric', 'imperial', 'pounds', 'kilograms', 'lbs', 'feet', 'inches', 'celsius', 'fahrenheit', 'miles', 'kilometers', 'liters', 'gallons', 'temperature', 'distance']);

  T('timezone', 'Time Zone Converter', 'Everyday', '/everyday-tools#tz',
    'See one moment in 11 time zones at once, with date changes flagged.',
    ['time zone converter', 'convert time zones', 'what time is it in tokyo', 'meeting time across time zones', 'est to pst', 'pst to est', 'utc to local time', 'schedule a call across time zones', 'time difference', 'world clock', 'gmt to est', 'cst to est', 'what time is it in seoul'],
    ['timezone', 'zone', 'zones', 'est', 'pst', 'cst', 'utc', 'gmt', 'seoul', 'tokyo'],
    { warn: [{ any: ['india', 'ist', 'mumbai', 'delhi', 'dubai', 'berlin', 'brazil', 'moscow', 'cairo', 'lagos', 'mexico', 'toronto', 'vancouver', 'hawaii', 'alaska', 'singapore', 'bangkok', 'manila', 'jakarta'],
      text: 'Heads up: this converter shows 11 fixed zones — US Pacific, Mountain, Central and Eastern, UTC, London, Paris, Seoul, Tokyo, Shanghai and Sydney. Other cities aren’t listed.' }] });

  /* ------------------------------------------------------------------ DEVELOPER */
  T('json', 'JSON Formatter', 'Developer', '/devtools#json',
    'Format, validate or minify JSON.',
    ['json formatter', 'format json', 'pretty print json', 'validate json', 'json validator', 'minify json', 'json beautifier', 'fix invalid json', 'json lint', 'json viewer', 'json error', 'prettify json', 'check if json is valid', 'is my json valid', 'json syntax error', 'json checker'],
    ['json', 'beautify', 'prettify', 'lint']);

  T('base64', 'Base64 Encode/Decode', 'Developer', '/devtools#b64',
    'Encode or decode Base64 text (UTF-8 safe, so Korean and emoji work).',
    ['base64 encode', 'base64 decode', 'decode base64', 'encode text to base64', 'base64 string', 'b64', 'base64 converter'],
    ['base64', 'b64']);

  T('uuid', 'UUID Generator', 'Developer', '/devtools#uuid',
    'Generate UUID v1, v4 or v7 identifiers — one at a time or in a batch.',
    ['uuid generator', 'generate a uuid', 'guid generator', 'random uuid', 'uuid v4', 'uuid v7', 'unique id generator', 'bulk uuid', 'generate guid', 'unique id', 'unique identifier', 'generate unique ids', 'random id'],
    ['uuid', 'guid', 'identifier', 'identifiers']);

  T('color', 'Color Converter', 'Developer', '/devtools#color',
    'Convert between HEX, RGB and HSL with a live preview and a contrast check.',
    ['color converter', 'hex to rgb', 'rgb to hex', 'hsl to rgb', 'rgb to hsl', 'hex to hsl', 'contrast checker', 'wcag contrast', 'color contrast ratio', 'accessible colors', 'color code converter', 'css color'],
    ['color', 'colour', 'hex', 'rgb', 'hsl', 'wcag', 'swatch']);

  T('url-encode', 'URL Encode/Decode', 'Developer', '/devtools#url',
    'Percent-encode text for a URL, or decode it back.',
    ['url encode', 'url decode', 'urlencode', 'percent encoding', 'encode a url', 'decode a url', 'encode a query string', 'escape a url', 'special characters in a url', 'uri encode'],
    ['url', 'uri', 'urlencode', 'percent']);

  T('dummy-data', 'Dummy Data Generator', 'Developer', '/devtools#dummy',
    'Fake but realistic names, emails, phone numbers and addresses for testing.',
    ['dummy data', 'fake data', 'test data', 'mock data', 'random names', 'fake names', 'fake emails', 'fake addresses', 'sample data', 'placeholder data', 'generate fake users', 'fake phone numbers', 'random user data', 'mock users'],
    ['dummy', 'fake', 'mock', 'faker', 'placeholder']);

  /* ------------------------------------------------------------------ 50 STATES + D.C. */
  var STATES = [['Alabama', 'alabama'], ['Alaska', 'alaska'], ['Arizona', 'arizona'], ['Arkansas', 'arkansas'], ['California', 'california'],
    ['Colorado', 'colorado'], ['Connecticut', 'connecticut'], ['Delaware', 'delaware'], ['Florida', 'florida'], ['Georgia', 'georgia'],
    ['Hawaii', 'hawaii'], ['Idaho', 'idaho'], ['Illinois', 'illinois'], ['Indiana', 'indiana'], ['Iowa', 'iowa'], ['Kansas', 'kansas'],
    ['Kentucky', 'kentucky'], ['Louisiana', 'louisiana'], ['Maine', 'maine'], ['Maryland', 'maryland'], ['Massachusetts', 'massachusetts'],
    ['Michigan', 'michigan'], ['Minnesota', 'minnesota'], ['Mississippi', 'mississippi'], ['Missouri', 'missouri'], ['Montana', 'montana'],
    ['Nebraska', 'nebraska'], ['Nevada', 'nevada'], ['New Hampshire', 'new-hampshire'], ['New Jersey', 'new-jersey'], ['New Mexico', 'new-mexico'],
    ['New York', 'new-york'], ['North Carolina', 'north-carolina'], ['North Dakota', 'north-dakota'], ['Ohio', 'ohio'], ['Oklahoma', 'oklahoma'],
    ['Oregon', 'oregon'], ['Pennsylvania', 'pennsylvania'], ['Rhode Island', 'rhode-island'], ['South Carolina', 'south-carolina'],
    ['South Dakota', 'south-dakota'], ['Tennessee', 'tennessee'], ['Texas', 'texas'], ['Utah', 'utah'], ['Vermont', 'vermont'],
    ['Virginia', 'virginia'], ['Washington', 'washington'], ['West Virginia', 'west-virginia'], ['Wisconsin', 'wisconsin'], ['Wyoming', 'wyoming'],
    ['Washington, D.C.', 'washington-dc']];
  STATES.forEach(function (s) {
    var nm = s[0], slug = s[1], low = nm.toLowerCase().replace(/[.,]/g, '');
    var e = { id: 'state-' + slug, type: 'state', name: nm + ' Paycheck Calculator', cat: 'Money & Tax', href: '/' + slug + '-paycheck-calculator',
      desc: 'Take-home pay in ' + nm + ' after federal tax, FICA and state tax.',
      does: [low + ' paycheck', low + ' paycheck calculator', low + ' take home pay', low + ' salary after tax', low + ' income tax', low + ' net pay', low + ' payroll tax', low + ' hourly pay after tax', low + ' state tax', low + ' tax rate', low + ' tax calculator'],
      kw: [low], req: [[low]] };
    if (slug === 'virginia') e.notIf = ['west'];
    if (slug === 'washington') e.notIf = ['dc', 'district', 'columbia'];
    if (slug === 'washington-dc') { e.req = [['dc', 'washington dc', 'district of columbia', 'district columbia']]; e.kw = ['dc', 'district', 'columbia']; e.does = ['dc paycheck', 'washington dc paycheck calculator', 'dc take home pay', 'dc salary after tax', 'district of columbia income tax', 'dc state tax', 'dc tax rate']; }
    tools.push(e);
  });

  /* ------------------------------------------------------------------ GUIDES */
  A('guide', 'guide-paycheck-tax', 'How Your Paycheck Tax Works', '/paycheck-tax-explained',
    'Why your paycheck is smaller than your salary: federal tax, FICA and state tax in plain English.',
    ['how paycheck tax works', 'why is my paycheck smaller than my salary', 'why is my paycheck so low', 'federal tax explained', 'fica explained', 'what is withholding', 'how is paycheck tax calculated', 'where does my paycheck go', 'why so much tax taken out', 'why is my paycheck less than my salary', 'why is my paycheck lower than i expected', 'why do i get less than my salary', 'where did my money go on my paycheck'],
    ['explained', 'withholding', 'fica']);
  A('guide', 'guide-paycheck-read', 'How to Read Your Paycheck', '/paycheck-guide',
    'What gross pay, net pay, FICA and withholding mean — line by line.',
    ['how to read my paycheck', 'what is gross pay', 'what is net pay', 'read a pay stub', 'what do the lines on my pay stub mean', 'gross vs net', 'deductions on my paycheck', 'what is ytd', 'understand my payslip'],
    ['stub', 'payslip', 'gross', 'net', 'ytd', 'deductions']);
  A('guide', 'guide-tax-brackets', '2026 Federal Tax Brackets Explained', '/tax-brackets-2026',
    'The 2026 federal brackets, what “marginal rate” means, and a worked example.',
    ['federal tax brackets', '2026 tax brackets', 'what is my tax bracket', 'marginal tax rate', 'what is a marginal rate', 'tax brackets explained', 'income tax rates 2026', 'how do tax brackets work', 'standard deduction'],
    ['bracket', 'brackets', 'marginal', 'standard deduction']);
  A('guide', 'guide-state-compare', '9 States Compared (2026)', '/state-tax-comparison-2026',
    'Real 2026 take-home numbers for Texas, Florida, Washington, Pennsylvania, Colorado, New Jersey, Illinois, New York and California.',
    ['best state for take home pay', 'which state is best for taxes', 'where does my paycheck go furthest', 'compare nine states', 'texas vs new york taxes', 'no income tax state take home', 'state tax comparison'],
    ['comparison', 'furthest']);
  A('guide', 'guide-401k-catchup', '401(k) Super Catch-Up (ages 60–63)', '/401k-super-catchup-explained',
    'Ages 60–63 get a higher 401(k) catch-up limit — worth up to $13,000 extra.',
    ['401k super catch up', 'catch up contribution age 60 to 63', 'secure 2.0 catch up', '401k limit at age 60', 'higher catch up limit', 'extra 401k contribution after 60', '401k contribution limits 2026'],
    ['secure', 'catchup', 'super']);
  A('guide', 'guide-capgains-stacking', 'Capital Gains Stacking Explained', '/capital-gains-stacking-explained',
    'Why the same $50,000 gain can be taxed at 7% or 17% depending on your other income.',
    ['how capital gains are taxed', 'capital gains brackets', 'long term capital gains rate explained', 'why is my capital gains tax different', 'gains stack on top of income', 'niit explained', '0 percent capital gains'],
    ['stacking', 'stack', 'niit']);
  A('guide', 'guide-compare-example', 'Same Salary, Three Different Paychecks', '/compare-worked-example',
    'A worked example: the same salary number in Texas, Ontario and England.',
    ['same salary different countries', 'texas vs ontario vs england', 'compare salary across countries worked example', 'why does the same salary give different take home'],
    ['worked', 'example']);
  A('guide', 'guide-uk-scotland', 'England/Wales/NI vs Scotland Tax', '/uk-scotland-tax-explained',
    'What actually differs in Scotland, with real numbers on who it helps and costs.',
    ['scotland vs england tax', 'scottish income tax bands', 'do i pay more tax in scotland', 'scotland tax explained', 'rest of uk vs scotland tax'],
    ['scotland', 'scottish', 'bands']);
  A('guide', 'guide-au-marginal', 'Your Real Australian Marginal Rate', '/au-marginal-rate-explained',
    'How the Low Income Tax Offset taper and Medicare levy push your real marginal rate up.',
    ['australian marginal tax rate', 'australia tax brackets explained', 'lito taper', 'medicare levy shade in', 'why is my real tax rate higher in australia'],
    ['marginal', 'taper', 'lito']);
  A('guide', 'guide-canada-mechanics', 'Ontario Surtax & Quebec Rules', '/canada-tax-mechanics',
    'How the Canada calculator handles Ontario’s surtax and Quebec’s federal abatement.',
    ['ontario surtax', 'quebec abatement', 'quebec tax explained', 'canadian payroll tax explained', 'how canada tax is calculated'],
    ['surtax', 'abatement']);
  A('guide', 'guide-ai-detector', 'Why We Don’t Claim 99% AI-Detector Accuracy', '/ai-detector-honesty',
    'The evidence on AI-detector false positives, and why our checker works differently.',
    ['are ai detectors accurate', 'ai detector false positives', 'can ai detectors be wrong', 'ai detector bias', 'is the ai checker reliable', 'turnitin ai accuracy'],
    ['accurate', 'accuracy', 'reliable', 'bias']);

  /* ------------------------------------------------------------------ ABOUT THE SITE */
  A('info', 'info-privacy', 'How This Actually Works (privacy)', '/how-it-works',
    'Everything runs in your browser. Here is how to check that nothing is uploaded.',
    ['is my data safe', 'do you upload my files', 'is this private', 'where do my files go', 'do you store my data', 'is it safe to use', 'does it upload my pdf', 'is my information sent anywhere', 'how can i trust this site', 'are my files stored', 'are my files uploaded to a server', 'is anything sent to your servers', 'do you keep a copy of my files'],
    ['privacy', 'private', 'safe', 'secure', 'upload', 'uploaded', 'stored', 'trust', 'server', 'servers']);
  A('info', 'info-free', 'No accounts, no limits', '/how-it-works#no-limits',
    'No sign-up, no file-size caps, no daily limits and no watermarks — and why.',
    ['is it free', 'do i need an account', 'sign up', 'log in', 'create an account', 'pricing', 'how much does it cost', 'is there a limit', 'file size limit', 'watermark', 'premium', 'subscription', 'free trial', 'do i have to pay'],
    ['free', 'account', 'login', 'signup', 'pricing', 'price', 'cost', 'premium', 'subscription', 'limit', 'limits', 'watermark', 'paywall']);
  A('info', 'info-verify', 'How We Verify Accuracy', '/how-we-verify',
    'Which sources the tax figures come from, how often they are re-checked, and a dated example.',
    ['how accurate are the calculators', 'where do the tax numbers come from', 'are the tax rates up to date', 'sources for tax data', 'how do you verify the numbers', 'is the calculator correct', 'how do you check accuracy'],
    ['verify', 'verified', 'accurate', 'accuracy', 'sources', 'source', 'correct', 'trustworthy']);
  A('info', 'info-feedback', 'Feedback & Bug Reports', '/feedback',
    'Report a bug or send feedback — it goes straight to the inbox.',
    ['report a bug', 'something is broken', 'contact you', 'email you', 'send feedback', 'this tool does not work', 'found a mistake', 'wrong result', 'contact support', 'report an error'],
    ['bug', 'feedback', 'contact', 'support', 'broken', 'mistake', 'error', 'report']);
  A('info', 'info-embed', 'Embed a Calculator on Your Site', '/embed',
    'Put a live PopPopMake calculator on your own website with one script tag.',
    ['embed a calculator on my website', 'put your calculator on my site', 'add paycheck calculator to my website', 'iframe', 'widget for my blog', 'embed code'],
    ['embed', 'iframe', 'widget', 'blog', 'website']);
  A('info', 'info-manual', 'User Manual', '/manual',
    'Step-by-step instructions for every tool, plus a downloadable Word version.',
    ['how do i use this', 'instructions', 'user manual', 'tutorial', 'step by step guide', 'how to use the tools', 'help using a tool', 'documentation'],
    ['manual', 'instructions', 'tutorial', 'walkthrough', 'documentation', 'docs']);
  A('info', 'info-about', 'About PopPopMake', '/about',
    'Who builds this site, why, and how the calculators are kept accurate.',
    ['who made this', 'who is behind this site', 'about this site', 'who runs poppopmake', 'who built this'],
    ['about', 'creator', 'founder', 'owner', 'author']);
  A('info', 'info-accessibility', 'Accessibility', '/accessibility',
    'What the site targets for accessibility (WCAG 2.1 AA), what has been checked and what has not.',
    ['screen reader support', 'accessibility', 'keyboard navigation', 'is this site accessible', 'wcag'],
    ['accessibility', 'accessible', 'screenreader', 'a11y']);
  A('info', 'info-changelog', 'Changelog', '/changelog',
    'What shipped, what got fixed, and why.',
    ['what is new', 'recent updates', 'what changed', 'new tools', 'release notes', 'latest updates'],
    ['changelog', 'updates', 'changes', 'news']);

  /* ================================================================== NOT BUILT YET
     Things people ask for that no page here does. They are matched BEFORE the normal
     ranking so that, say, "compress pdf" does not get pointed at the image compressor
     as if it were the answer. Each one shows an honest note, the closest real tools,
     and the "ask us to build it" button.  Delete a line once the tool exists.
     all:  every group needs at least one of its words in the question
     not:  if any of these groups also matches, this line does not apply
     rx:   regular expressions tried on the cleaned question (alternative to "all")
     soft: true = the closest tool is shown as the main answer, with the note beside it */

  /* --- PDF --- */
  G('pdf-compress', 'Compress a PDF',
    { all: [['compress', 'shrink', 'reduce', 'smaller', 'size', 'mb', 'kb', 'lighter', 'optimize', 'weigh'], ['pdf']],
      not: [['image', 'photo', 'picture', 'jpg', 'jpeg', 'png', 'webp', 'merge', 'split', 'break', 'part', 'parts', 'piece', 'pieces', 'chunk', 'chunks', 'section', 'sections', 'divide', 'separate', 'extract']],
      rx: [/pdf.*\b(too|so|very|really)\s+(big|large|heavy)\b/, /\b(too|so|very|really)\s+(big|large|heavy)\b.*pdf/] },
    'Our compressor works on photos (JPG, PNG, WebP), not on PDF files.', ['compress-image']);
  G('pdf-convert-out', 'Convert a PDF to Excel, PowerPoint, HTML or other formats',
    { rx: [/\bpdf\s*(to|into|2)\s*(excel|xlsx?|csv|ppt|pptx|powerpoint|html|epub|rtf|odt|gif|tiff?|svg|markdown)\b/,
           /\b(convert|turn|change|export|save)\s+(a\s+|my\s+|the\s+|this\s+)?pdf\s+(to|into|as)\s+(a\s+|an\s+)?(excel|xlsx?|csv|ppt|pptx|powerpoint|html|epub|rtf|odt)\b/] },
    'We can turn a PDF into pictures (JPG, PNG, WebP), plain text, or a Word file with the text only, but not into Excel, PowerPoint or other formats.', ['file-converter', 'ocr']);
  G('pdf-convert-in', 'Convert Word, Excel or PowerPoint to PDF',
    { rx: [/\b(word|docx?|excel|xlsx?|powerpoint|pptx?|html|rtf|odt|txt|webpage|web page|google docs?|google sheets?)\s*(to|into|2)\s*pdf\b/,
           /\b(convert|turn|save|export|print)\s+(a\s+|an\s+|my\s+|the\s+)?(word|docx?|excel|xlsx?|powerpoint|ppt|html|google docs?)\b.*\bpdf\b/] },
    'We can turn photos (JPG, PNG, HEIC and more) into a PDF, but not Word, Excel or PowerPoint files.', ['images-to-pdf', 'file-converter']);
  G('pdf-edit', 'Edit or fill in a PDF',
    { rx: [/\bedit\s+(a\s+|an\s+|my\s+|the\s+|this\s+)?pdf/, /\b(edit|change|modify|replace|rewrite|fix|correct)\b.*\b(text|words?|name|date|number|typo|content)\b.*\bpdf\b/,
           /\b(fill|fill out|fill in)\b.*\b(pdf|forms?)\b/, /\b(complete|type|write)\b.*\bpdf\s+forms?\b/, /\bpdf\s+(editor|filler)\b/, /\bfillable\b/,
           /\b(add|insert|put|write|type)\b.*\b(text|words?|logo)\b.*\bpdf\b/, /\bpdf\b.*\b(add|insert|put)\b.*\b(text|logo)\b/,
           /\b(annotate|highlight|comment on|markup|mark up)\b.*\bpdf\b/, /\bpdf\b.*\b(annotate|highlight|annotation|markup)\b/],
      not: [['w4', 'w2', 'w9', '1040', 'irs', 'tax return', 'tax form']] },
    'There’s no full PDF editor. Redact PDF can black out text and write new text over it, which covers simple fixes.', ['redact-pdf']);
  G('pdf-sign', 'Sign a PDF',
    { all: [['sign', 'signature', 'esign', 'docusign', 'initial', 'signing'], ['pdf', 'document', 'contract', 'agreement', 'form']] },
    'There’s no e-signature tool yet.');
  G('pdf-password', 'Unlock or password-protect a PDF',
    { rx: [/\bpdf\b.*\b(password|passcode|encrypt\w*|decrypt\w*|unlock\w*|lock(ed)?|restrictions?)\b/, /\b(password|passcode|encrypt\w*|decrypt\w*|unlock\w*|locked|restrictions?)\b.*\bpdf\b/] },
    'There’s no PDF password tool, and our PDF tools refuse password-protected files (open it in a PDF viewer and use Print → Save as PDF to make an unprotected copy).');
  G('pdf-pages', 'Rotate, reorder, number or watermark PDF pages',
    { rx: [/\b(rotate|flip|reorder|rearrange|reverse|sort|crop|resize|flatten|watermark|stamp|bookmark|paginate)\b.*\bpdf\b/, /\bpdf\b.*\b(rotate|flip|reorder|rearrange|crop|flatten|watermark|bookmark|stamp)\b/,
           /\bpage numbers?\b/, /\b(add|insert|put)\b.*\b(watermark|header|footer|stamp|bookmarks?)\b/] },
    'Rotating, reordering, numbering or watermarking PDF pages isn’t available. Split PDF and Merge PDFs can pick and combine whole pages.', ['split-pdf', 'merge-pdf']);
  G('pdf-other', 'Other PDF jobs (compare, repair, convert to PDF/A, read aloud)',
    { all: [['compare', 'diff', 'repair', 'fix', 'corrupt', 'corrupted', 'pdfa', 'archive', 'speech', 'read aloud', 'translate', 'summarize', 'summary', 'chat', 'ask'], ['pdf']],
      rx: [/\b(to|into|as|in|convert|save|export)\s+pdf ?a\b|\bpdf ?a\s+(format|compliance|conversion|archiv\w*)\b/] },
    'That PDF job isn’t available.');

  G('hwp', 'Korean HWP documents',
    { rx: [/\bhwpx?\b/, /\bhangul (word|document|file)s?\b/, /\bhancom\b/] },
    'We can’t open or convert HWP files. Save the document as a PDF from Hancom Office first — then our PDF tools can merge, split, redact or clean it.', ['merge-pdf', 'split-pdf', 'redact-pdf']);

  /* --- images --- */
  G('image-formats', 'Other image formats (SVG, RAW, Photoshop, or saving as HEIC, GIF or AVIF)',
    { rx: [/\b(svg|raw|psd|eps|cr2|nef|dng|arw)\b/, /\b(to|into|as|2)\s+(an?\s+)?(animated\s+)?(heic|heif|gif|avif)\b/] },
    'We can’t open SVG, camera RAW or Photoshop files, or save pictures as HEIC, GIF or AVIF. HEIC, JPG, PNG, WebP, GIF, BMP and AVIF files can be opened, and saved as JPG, PNG, WebP, BMP, TIFF, ICO or PDF.', ['file-converter'], true);
  G('image-exif', 'Remove location or EXIF data from a photo',
    { all: [['remove', 'delete', 'strip', 'clean', 'erase', 'hide', 'scrub'], ['exif', 'gps', 'location', 'geotag', 'metadata'], ['photo', 'image', 'picture', 'jpg', 'jpeg', 'png', 'selfie']] },
    'Clean Metadata works on PDFs, not on photos.', ['clean-metadata']);
  G('office-metadata', 'Remove metadata or edit history from a Word, Excel or PowerPoint file',
    { rx: [/\b(docx?|xlsx?|pptx?|word|excel|powerpoint|spreadsheet|office)\b.*\b(metadata|author|edit history|revision history|tracked changes|document properties|hidden (data|information|text))\b/,
           /\b(metadata|author|edit history|revision history|tracked changes|document properties|hidden (data|information|text))\b.*\b(docx?|xlsx?|pptx?|word|excel|powerpoint|spreadsheet)\b/] },
    'Clean Metadata works on PDF files only, not on Word, Excel or PowerPoint files.', ['clean-metadata'], true);
  G('image-edit', 'Edit a photo (rotate, filters, collage, meme, frames)',
    { rx: [/\b(rotate|flip|mirror|straighten)\b.*\b(image|photo|picture|pic|screenshot)s?\b/, /\b(rotate|flip|mirror)\s+(an?\s+|the\s+|my\s+|this\s+)?(image|photo|picture|pic|screenshot)s?\b/, /\b(image|photo|picture)\s+(rotate|rotation|flip)\b/, /\b(grayscale|greyscale|sepia|vignette|saturation|brightness|collage|meme|sticker|photo editor|image editor|photoshop|photo filters?|image filters?|instagram filters?|red eye|black and white photo|passport photo|id photo)\b/,
           /\bfilters?\b.*\b(photo|image|picture|pic|selfie)s?\b/, /\b(photo|image|picture|pic|selfie)s?\b.*\bfilters?\b/] },
    'We don’t have a general photo editor. Screenshot Markup can crop, draw, add text and blur an area.', ['screenshot-markup', 'remove-bg', 'enhance-quality'], true);
  G('image-generate', 'Generate an image or logo with AI',
    { rx: [/\btext (to|2) (image|picture|art)\b/, /\bai\s+(art|image|images|picture|pictures|photo|photos|avatar|avatars|logo|logos|illustration|wallpaper)\b/, /\b(midjourney|dall ?e|stable diffusion|image generator|ai generator|art generator)\b/,
           /\bai\b.*\b(logo|avatar|illustration|wallpaper|poster|icon|artwork)s?\b/, /\b(logo|avatar|illustration|wallpaper|poster|icon|artwork)s?\b.*\bai\b/,
           /\b(make|create|generate|draw|design|paint|produce|render)\s+(?:me\s+)?(?:an?|some)\s+(?:\w+\s+){0,2}(?:images?|pictures?|photos?|art|artwork|drawings?|illustrations?|logos?)\b.*\b(ai|artificial intelligence)\b/, /\b(ai|artificial intelligence)\b.*\b(make|create|generate|draw|design|paint|produce|render)\s+(?:me\s+)?(?:an?|some)\s+(?:\w+\s+){0,2}(?:images?|pictures?|photos?|art|artwork|drawings?|illustrations?|logos?)\b/,
           /\b(generate|create|draw|design|paint|produce)\b.*\b(images?|pictures?|photos?|art|artwork|drawings?)\b.*\b(ai|artificial intelligence)\b/, /\bai\b.*\b(generate|create|draw|design|paint|produce)\b.*\b(images?|pictures?|photos?|art|artwork|drawings?)\b/],
      not: [['compress', 'resize', 'enhance', 'sharpen', 'remove', 'erase', 'blur', 'upscale', 'unblur']] },
    'We don’t generate images or logos.');
  G('video', 'Video tools',
    { rx: [/\b(videos?|mp4|mov|avi|mkv|webm|movies?|clips?|reels?|film|footage|subtitles?|srt|screen recording|screen recorder)\b/] },
    'We don’t have any video tools.');
  G('audio', 'Audio tools',
    { rx: [/\b(audio|mp3|wav|m4a|flac|podcasts?|music|songs?|ringtones?|voice (recording|memo|note)s?|recordings?|recorded (call|meeting|interview|lecture|voice)|background noise|noise (removal|reduction|cancel\w*)|transcrib\w*|transcription|dictation|dictate)\b/, /\b(speech|voice|spoken)\b.*\b(text|transcri\w*|captions?)\b/, /\b(text|transcri\w*)\b.*\b(speech|voice|audio)\b/] },
    'We don’t have any audio tools.');

  /* --- writing --- */
  G('grammar', 'Grammar, spelling or proofreading',
    { all: [['grammar', 'spelling', 'spell', 'proofread', 'proofreading', 'typo', 'typos', 'punctuation', 'grammarly', 'paraphrase', 'rephrase', 'rewrite', 'summarize', 'summarise']],
      rx: [/\b(flow|flows|flowing|read|reads|sound|sounds)\b.*\b(better|smoother|nicer|clearer|more professional|more polished)\b.*\b(writing|essay|paragraph|text|draft|sentences?|email)\b/, /\b(writing|essay|paragraph|text|draft|sentences?)\b.*\b(flow|flows|flowing)\b.*\b(better|smoother|nicely|well)\b/,
           /\b(polish|improve|edit|proofread|tighten|refine)\s+(my|the|this|our)\s+(writing|essay|paragraph|text|draft|sentences?|paper|report)\b/],
      not: [['resume', 'cv', 'smooth']] },
    'We don’t check grammar or rewrite text. Smooth It Out suggests plainer words for stiff or AI-sounding phrases.', ['smooth-it-out', 'word-count'], true);
  G('translate', 'Translate text',
    { all: [['translate', 'translation', 'translator', 'translating']] },
    'We don’t translate text.');
  G('ai-writing', 'Write something for me (essay, email, story)',
    { all: [['essay', 'article', 'blog', 'story', 'poem', 'speech', 'homework', 'assignment', 'slogan', 'lyrics', 'joke', 'paper', 'thesis', 'email', 'letter', 'message', 'caption', 'script', 'paragraph', 'tweet'], ['write', 'draft', 'compose', 'ai']],
      not: [['cover', 'resume', 'cv', 'invoice', 'detector', 'cliche', 'smooth', 'robotic', 'find', 'detect', 'spot', 'highlight', 'scan', 'flag', 'isms', 'sounding']] },
    'We don’t write text for you. The Cover Letter tool formats what you write yourself.', ['cover-letter']);
  G('plagiarism', 'Plagiarism or similarity check',
    { rx: [/\b(plagiari\w*|turnitin|copyscape|similarity (check|checker|score|report)|originality (check|checker|report)|duplicate content|copied (from|content|text|work)|is this original)\b/],
      not: [['accuracy', 'accurate', 'reliable', 'detector', 'detection', 'false']] },
    'We don’t check text for plagiarism.', ['ai-cliche-check']);
  G('text-utils', 'Text utilities (case converter, sort lines, remove duplicates, compare text)',
    { rx: [/\b(lorem ipsum|dummy text|case converter|uppercase|lowercase|title case|sentence case|camel case|snake case|sort lines|alphabeti[sz]e|remove duplicates?|duplicate lines|remove spaces|line breaks?|find and replace|text diff|compare text|diff checker|reverse text|fancy text|font generator|ascii art|text to handwriting|remove extra spaces|slug)\b/] },
    'We don’t have that text utility yet. Word Count & Readability counts words, characters and sentences.', ['word-count'], true);

  /* --- developer --- */
  G('data-convert', 'Convert between data formats (CSV, XML, YAML, SQL ↔ JSON)',
    { rx: [/\b(csv|tsv|xml|yaml|yml|toml|sql|markdown|md|html|excel|xlsx)\s*(to|into|2)\s*(json|csv|xml|yaml|yml|html|markdown|sql|table|excel|xlsx)\b/, /\bjson\s*(to|into|2)\s*(csv|tsv|xml|yaml|yml|toml|sql|html|markdown|excel|xlsx|typescript|ts|java|python|class)\b/] },
    'The JSON Formatter formats, validates and minifies JSON, but doesn’t convert it to or from other formats.', ['json'], true);
  G('dev-formats', 'Other developer tools (regex, hash, JWT, timestamps, diff, minify, cron)',
    { rx: [/\b(regex|regexp|regular expression|sha\s?\d*|md5|hash generator|bcrypt|jwt|epoch|unix time|unix timestamp|timestamp converter|cron|crontab|diff checker|minify (css|js|javascript|html)|css minifier|js minifier|sql formatter|html formatter|css formatter|xml formatter|yaml validator|markdown preview|markdown editor|htaccess|robots\.?txt|sitemap generator|meta tag|open graph|ip address|dns lookup|whois|user agent|binary|hexadecimal|ascii|morse|roman numerals?|number base)\b/] },
    'That developer tool isn’t available yet. We have JSON, Base64, UUID, color and URL tools, plus a dummy-data generator.', ['json', 'base64', 'uuid', 'url-encode'], true);
  G('website-seo', 'Websites, hosting, SEO or social media tools',
    { rx: [/\b(make|build|create|design|host|launch|set up|setup)\s+(?:(?:me|us|a|an|my|our|the|new|free|simple|personal|business|professional|small|basic|online|custom)\s+){0,4}(?:\w+\s+)?(website|web site|web page|webpage|homepage|home page|online store|ecommerce|e commerce|shopify|wordpress|portfolio site)\b/],
      not: [['embed', 'iframe', 'widget', 'calculator'], ['character', 'characters', 'count', 'counter', 'word', 'words', 'length', 'limit']],
      all: [['seo', 'backlink', 'backlinks', 'keyword research', 'domain', 'hosting', 'ssl', 'website builder', 'landing page', 'instagram', 'tiktok', 'hashtag', 'hashtags', 'twitter', 'facebook', 'social media', 'bio', 'thumbnail', 'youtube']] },
    'We don’t have website or social-media tools.');

  /* --- money & tax --- */
  G('paycheck-other-country', 'Paycheck or tax calculator for another country',
    { all: [['india', 'indian', 'germany', 'german', 'france', 'french', 'spain', 'spanish', 'italy', 'italian', 'netherlands', 'ireland', 'irish', 'japan', 'japanese', 'korea', 'korean', 'china', 'chinese', 'singapore', 'hong kong', 'brazil', 'mexico', 'nigeria', 'south africa', 'uae', 'dubai', 'philippines', 'new zealand', 'switzerland', 'swiss', 'sweden', 'swedish', 'norway', 'norwegian', 'denmark', 'danish', 'poland', 'portugal', 'israel', 'turkey', 'pakistan', 'bangladesh', 'vietnam', 'thailand', 'indonesia', 'malaysia', 'kenya', 'ghana', 'egypt', 'saudi', 'argentina', 'chile', 'colombia', 'peru', 'russia', 'ukraine', 'greece', 'austria', 'belgium', 'finland', 'europe', 'european', 'eu'],
             ['tax', 'paycheck', 'salary', 'takehome', 'take home', 'net pay', 'income', 'payroll', 'wage', 'wages', 'pay', 'earn', 'after tax', 'vat', 'gross']],
      not: [['new mexico'], ['northern ireland']] },
    'We cover the US (all 50 states + D.C.), the UK, Australia and Canada so far.', ['paycheck-us', 'paycheck-uk', 'paycheck-au', 'paycheck-ca', 'compare-takehome']);
  G('tax-self-employed', 'Self-employment or freelancer tax',
    { all: [['selfemployed', 'self employed', 'self employment', 'freelancer', 'freelance', '1099', 'independent contractor', 'sole proprietor', 'sole proprietorship', 'side hustle', 'se tax', 'gig worker'],
            ['tax', 'taxes', 'irs', 'deduction', 'deductions', 'write off', 'estimated', 'quarterly', 'withhold', 'withholding', 'owe']],
      not: [['invoice', 'invoices', 'resume', 'cv', 'cover']],
      rx: [/\b(self[ -]?employ\w*|1099|schedule c|sole propriet\w*|estimated (quarterly )?tax|quarterly (estimated )?tax(es)?|freelanc\w* tax|side hustle tax|gig (worker|economy) tax)\b/] },
    'The paycheck calculators are for employees. Self-employment tax, 1099 income and quarterly estimates aren’t covered.', ['paycheck-us', 'capital-gains']);
  G('tax-filing', 'Tax return, refund, W-4 or deductions',
    { rx: [/\b(tax return|tax refund|refund calculator|file (my |our )?taxes|filing status|1040|w[2349]|itemi[sz]ed deductions?|tax credit|child tax credit|eitc|earned income credit|turbotax|tax software|amend\w* return|irs form|tax form|tax filing|tax estimator|tax preparation)\b/] },
    'We estimate paychecks and investment-sale tax, not full tax returns, refunds, W-4 settings or credits.', ['paycheck-us', 'guide-tax-brackets']);
  G('tax-other', 'Sales tax, VAT, property tax, estate or other taxes',
    { rx: [/\b(sales tax|vat|gst|hst|property tax calculator|estate tax|inheritance tax|gift tax|excise tax|import duty|customs duty|payroll tax calculator|employer tax|unemployment tax|use tax|luxury tax|stamp duty|transfer tax|wealth tax|corporate tax)\b/] },
    'That tax calculator isn’t available yet.', ['paycheck-us']);
  G('loan-other', 'Car, student or personal loan calculator',
    { not: [['mortgage', 'house loan', 'home loan', 'housing loan']],
      rx: [/\b(car|auto|vehicle|truck|motorcycle|boat|rv|student|personal|business|payday|home equity|installment)\s+(loan|payment|financing|lease)\b/, /\b(loan calculator|loan payment|loan interest|emi calculator|amortization schedule|apr calculator|interest rate calculator|refinance|refi|heloc|lease vs buy|balloon|payoff date|biweekly mortgage)\b/, /\bcar payment\b/] },
    'We have mortgage and debt-payoff calculators, but no car, student or personal-loan calculator yet.', ['mortgage', 'debt-payoff'], true);
  G('invest-calc', 'Compound interest, savings, investing or Roth/IRA calculators',
    { rx: [/\b(compound interest|simple interest|interest calculator|savings calculator|savings goal|roi|return on investment|cagr|apy|investment calculator|dividend|dividends|inflation calculator|roth|ira|index fund|fire calculator|retire early|coast fi|annuity|cd rates?|bonds?|stock return|dca|dollar cost|rebalanc\w*)\b/],
      not: [['mortgage', 'loan']] },      // "home loan interest calculator" is a loan question, not a savings one
    'Compound-interest, savings, Roth/IRA and investing calculators aren’t available. The 401(k) calculator projects a workplace retirement balance.', ['retirement-401k', 'capital-gains'], true);
  G('budget', 'Budgeting, expenses or net worth',
    { rx: [/\b(budget|budgeting|expense tracker|expenses|spending tracker|net worth|savings plan|50 30 20|zero based|bill tracker|subscription tracker|allowance|rent split|split rent|roommate)\b/] },
    'We don’t have budgeting or expense tools yet. Tip & Split Calculator divides a restaurant bill.', ['tip-split']);
  G('currency', 'Currency conversion or exchange rates',
    { rx: [/\b(usd|eur|gbp|krw|jpy|cad|aud|inr|cny|mxn|chf|nzd|sgd|hkd|brl|try|zar|dollars?|euros?|pounds?|won|yen|yuan|rupees?|pesos?)\s*(to|in|into|2|vs)\s*(usd|eur|gbp|krw|jpy|cad|aud|inr|cny|mxn|chf|nzd|sgd|hkd|brl|try|zar|dollars?|euros?|pounds?|won|yen|yuan|rupees?|pesos?)\b/, /\b(currency|exchange rate|forex|fx rate|convert (usd|eur|gbp|krw|jpy|cad|aud|dollars?|euros?)|currency converter)\b/] },
    'We don’t convert currencies (live exchange rates would need a data feed).');
  G('market-data', 'Stock, crypto or market prices',
    { rx: [/\b(bitcoin|btc|ethereum|eth|dogecoin|doge|solana|ripple|xrp|litecoin|crypto|cryptocurrency|coins?|nft|stock|stocks|shares?|tesla|apple|nvidia|amazon|google|microsoft)\s+(price|prices|chart|quote|rate|value|today|live)\b/, /\bprice of (bitcoin|btc|ethereum|eth|dogecoin|doge|crypto|a stock|stocks)\b/,
           /\b(stock price|share price|crypto price|bitcoin price|price of bitcoin|ticker|stock quote|stock chart|market cap|live price|stock screener|what stocks|which stocks|best stocks|buy stocks|should i buy|should i invest|investment advice|financial advice)\b/] },
    'We don’t show market prices or give investment advice.', ['capital-gains']);
  G('benefits-other', 'Social Security, pension, raise or severance calculators',
    { rx: [/\b(social security (benefit|estimate|calculator|age|payment|check|income|retirement|claim|tax)\w*|pensions?|rmd|required minimum|medicare (cost|premium)|severance|pto payout|unemployment (benefit|claim)|disability benefit|pay raise|salary increase|raise calculator|cost of living adjustment|cola|salary negotiation|negotiate (my )?salary|commission calculator|tax on severance)\b/] },
    'That benefits or pay calculator isn’t available. The paycheck calculators already handle overtime and bonuses.', ['paycheck-us', 'retirement-401k'], true);
  G('real-estate', 'Rent, home value or real-estate tools',
    { rx: [/\b(rent|rental|landlord|tenant|security deposit|lease|home value|house value|zestimate|real estate|closing costs?|mortgage points|rent vs buy|rent or buy|home appraisal|cap rate|rental yield|airbnb|property value)\b/] },
    'We don’t have rent or real-estate tools yet. The Mortgage Calculator covers the full monthly cost of owning a home.', ['mortgage'], true);

  /* --- health --- */
  G('health-other', 'Other health or fitness calculators',
    { rx: [/\b(body fat|macros?|macro calculator|protein intake|ideal weight|pregnan\w*|due date|ovulation|period tracker|water intake|heart rate|blood pressure|sleep calculator|step counter|running pace|pace calculator|one rep max|1rm|waist to hip|whr|bsa|gfr|blood alcohol|bac|vitamin|symptoms?|diagnos\w*|medicine|medication|dosage|drug|doctor|lab results?|cholesterol|blood sugar|a1c|diabetes|workout plan|meal plan|diet plan|keto|intermittent fasting)\b/] },
    'We only have BMI and calorie calculators. We don’t offer medical tools or advice.', ['bmi', 'calorie'], true);

  /* --- career / business / everyday --- */
  G('career-other', 'Job search, interview, LinkedIn or reference-letter help',
    { rx: [/\b(job search|find a job|job board|job listings?|interview (questions|prep|practice)|mock interview|linkedin|resume review|cv review|portfolio|offer letter|reference letter|recommendation letter|resignation letter|thank you letter|personal statement|career test|career quiz)\b/] },
    'We build resumes and cover letters and check a resume against a job description, but we don’t help with job searches, interviews or other career letters.', ['resume-builder', 'ats-checker', 'cover-letter'], true);
  G('qr-scan', 'Scan or read a QR code / barcode',
    { rx: [/\b(scan|read|reader|scanner|decode)\b.*\b(qr|barcode)\b/, /\b(qr|barcode)\b.*\b(scan|reader|scanner|decode)\b/] },
    'We make QR codes but can’t scan them — your phone’s camera app does that.', ['qr-code'], true);
  G('business-other', 'Receipts, quotes, contracts, logos or other business documents',
    { rx: [/\b(receipt|quote|quotation|estimate template|proposal|contract|nda|non disclosure|agreement|purchase order|timesheet|time tracking|payroll software|profit margin|markup calculator|break even|business plan|pitch deck|business card|logo maker|barcode|shipping label|tracking number|bookkeeping|expense report|late fee|terms and conditions generator|privacy policy generator|letterhead)\b/] },
    'We have an invoice generator and a QR code generator, but no receipts, quotes, contracts, business cards or logos yet.', ['invoice', 'qr-code'], true);
  G('date-other', 'Countdowns, adding days to a date, business days, calendars',
    { not: [['birthday', 'birth', 'dob', 'age', 'old'], ['timer', 'stopwatch', 'alarm', 'pomodoro']],
      rx: [/\b(countdown|days (until|left|till|to go)|how many days (until|till|to)|weeks until|add (\d+ )?days? to|subtract days|working days|business days|workdays|week number|day of the week|what day|leap year|holiday|zodiac|date calculator|time calculator|hours calculator|time card|duration calculator)\b/] },
    'We have no countdown or date-adding calculator. The Age Calculator gives the exact time between two dates and the days to your next birthday.', ['age-calc'], true);
  G('random-tools', 'Random picker, dice, coin flip, quiz or games',
    { rx: [/\b(random number|random picker|name picker|dice|coin flip|flip a coin|lottery|raffle|spin the wheel|wheel of names|draw lots|magic 8|quiz|trivia|crossword|sudoku|wordle|game|games|fortune|horoscope|tarot|compatibility)\b/] },
    'We don’t have random pickers, games or quizzes.');
  G('productivity', 'Timers, to-do lists, notes or reminders',
    { rx: [/\b(timer|stopwatch|alarm|pomodoro|reminder|to ?do list|todo|note taking|notepad|sticky notes?|notebook|take notes|notes app|checklist|habit tracker|planner|schedule maker|calendar|gantt|kanban|meeting scheduler)\b/] },
    'We don’t have timers, to-do lists or planners.');
  G('math-other', 'Math, grades, GPA or science calculators',
    { rx: [/\b(fractions?|scientific calculator|algebra|equations?|quadratic|standard deviation|square root|exponent|gcd|lcm|prime numbers?|pythagorean|triangle area|gpa|grade calculator|final grade|test score|weighted average|probability|permutation|combinations?|statistics|matrix|derivative|integral|logarithm|sine|cosine|median|mean and median)\b/] },
    'We don’t have a general math or grades calculator. The Percentage Calculator handles percent-of, percent change and discounts.', ['percentage'], true);
  G('unit-other', 'Other unit conversions (area, speed, cooking, data size, shoe size)',
    { rx: [/\b(oz|ounces?|grams?|mg|cups?|tbsp|tablespoons?|tsp|teaspoons?|ml|milliliters?|quarts?|pints?|sq\.? ?ft|square (feet|foot|meters?|metres?|miles|kilometers?)|m2|sqm|acres?|hectares?|pyeong|mph|kph|km\/h|mpg|bytes?|kilobytes?|megabytes?|gigabytes?|psi|fuel economy|shoe size|clothing size|ring size|bra size)\b.*\b(to|in|into|2)\b/, /\b(area|speed|cooking|recipe|data size|file size) (converter|conversion)\b/, /\b(shoe|clothing|ring|bra|hat|dress) sizes?\b/, /\b(cups? to|to cups?|ounces? to|to ounces?|grams? to|to grams?)\b/] },
    'The Unit Converter handles height (cm ↔ ft/in), weight (kg ↔ lb), temperature (°C ↔ °F), distance (km ↔ mi) and volume (L ↔ US gal) only.', ['unit-convert'], true);
  G('password-other', 'Password strength, manager or passphrase',
    { rx: [/\b(password (strength|checker|manager|vault|test)|check (my )?password|passphrase|diceware|breach(ed)?|pwned|2fa|two factor|authenticator|otp)\b/,
           /\b(is|are|was)\b[^.]*\bpassword\b[^.]*\b(strong|safe|secure|weak|good enough)\b/, /\bcheck\b[^.]*\bpassword\b[^.]*\b(strong|safe|secure|weak)\b/,
           /\bhow (strong|safe|secure)\b[^.]*\bpassword\b/, /\bpassword\b[^.]*\b(leaked|hacked|cracked?|breached|pwned|rating|score)\b/] },
    'We generate random passwords but don’t check strength, store passwords or make word-based passphrases.', ['password-gen'], true);

  /* ================================================================== EXTRA PHRASING */
  /* More ways people ask for the same thing, found by testing the finder with questions it had never seen.
     more(id, [sentences], [keywords]) adds to a page above; add a line here whenever a visitor's wording is missed. */
  function more(id, sentences, keywords) {
    for (var i = 0; i < tools.length; i++) {
      if (tools[i].id === id) {
        tools[i].does = (tools[i].does || []).concat(sentences || []);
        if (keywords) tools[i].kw = (tools[i].kw || []).concat(keywords);
        return;
      }
    }
    throw new Error('help-index: unknown page ' + id);
  }
  more('ai-cliche-check', ['chatgpt isms', 'find ai tells in my writing', 'find ai phrases in my text', 'words that sound like chatgpt', 'find chatgpt phrases in my article']);
  more('guide-ai-detector', ['can ai detectors be trusted', 'are ai detectors accurate', 'do ai detectors work', 'ai detector false positives', 'can teachers tell if i used chatgpt', 'is turnitin ai detection reliable']);
  more('info-privacy', ['do you collect my data', 'do you sell my data', 'do you track me', 'do you share my information', 'what happens to my files']);
  more('info-about', ['what is your story', 'tell me about this site', 'about you']);
  more('ocr', ['turn a screenshot into editable text', 'editable text from an image', 'make text editable', 'get the words out of a picture'], ['editable']);
  more('screenshot-markup', ['blur out my email address in a screenshot', 'hide personal details in a screenshot', 'blur out text', 'blur a name']);
  more('calorie', ['how many calories do i burn per day', 'calories burned per day', 'how many calories should i eat', 'how many calories do i need']);
  more('word-count', ['how long does it take to read this article', 'estimated reading time of an article', 'character counter', 'character limit for a tweet', 'twitter character count']);
  more('age-calc', ['how old will i be on a date', 'how old will i be in 2030', 'what age will i be in a year', 'how many days between two dates', 'days between dates']);
  more('password-gen', ['password with 20 characters', 'random password 16 characters', 'give me a 20 character password']);
  more('guide-paycheck-read', ['what is the difference between gross and net pay', 'gross pay vs net pay', 'what is net pay']);
  more('cover-letter', ['format a cover letter pdf', 'cover letter format']);
  more('split-pdf', ['break a big pdf into smaller parts', 'split a large pdf', 'make a pdf smaller by splitting it into parts']);
  more('merge-pdf', ['join invoices into one pdf', 'put several pdfs into one pdf', 'join my files into one pdf']);
  more('remove-bg', ['background gone from a headshot', 'get rid of the background in a portrait', 'remove background from headshot']);
  more('compress-image', ['photo too large for a form', 'image is over 2mb', 'reduce a picture under 2mb', 'file size too big for upload', 'photo is 8mb and the form only accepts 2mb']);
  more('compare-takehome', ['new york vs florida take home', 'california vs washington paycheck', 'ontario vs texas take home', 'uk vs us salary', 'london vs new york salary']);
  more('paycheck-us', ['how much is 65000 a year after taxes', 'what is 80000 a year after tax']);

  /* ================================================================== WORD HANDLING */
  /* Words that carry no meaning for matching. */
  var STOP = ('a an the and or but if then than so as at by for from in into of on onto to with without within about above after again against all also am any are aren arent around ' +
    'be because been before being below between both can cant cannot could couldnt did didnt do does doesnt doing done dont down during each either else even ever every few ' +
    'get gets getting go goes going got gotta had has hasnt have havent having he her here hers herself him himself his how hows however i id ill im ive its itself ' +
    'just let lets like liked likes little lot lots make makes making many may maybe me might mine more most much must my myself ' +
    'need needs needed no nor not now of off ok okay once one ones only other others our ours ourselves out over own per please plus quite rather really same several shall she should shouldnt since some somehow someone something sometimes still such ' +
    'take taking thank thanks that thats their theirs them themselves there theres these they theyre this those though through thus till too toward towards two three under until up upon us ' +
    'use used using very via want wants wanted wanna was wasnt way ways we well were weren what whats when whenever where which while who whom whose why will wish would wouldnt yet you your youre yours yourself ' +
    'able anyone anything anywhere anyway everything everyone first second third next last new old good best better easy easily fast quick quickly simple simply online ' +
    'hello hi hey help helps helping helper assist looking look looks find finding show tell give know think try trying tried thing things stuff kind sort type ' +
    'file files document documents doc docs tool tools app apps website site web program software service item items ' +
    'today tonight tomorrow yesterday soon already always never often usually ' +
    'say said says ask asking idea ideas problem problems issue issues solve solving fix fixing work works working ' +
    'nothing none nobody somewhere yes yeah yep nope pls plz thx ty ' +
    'it is yourselves further isnt wasnt werent hadnt mustnt youve youll youd hes shes theyve theyll theyd weve wed wheres whos ' +
    'actually basically literally honestly kinda gonna another whatever whichever although figure').split(/\s+/);

  /* Words kept for matching but never counted against a result when it does not contain them. */
  var SOFT = ['free', 'cheap', 'quickly', 'calculator', 'generator', 'convert', 'year', 'month', 'week', 'monthly', 'weekly', 'check'];

  /* Words that mean the same thing for matching (left word -> right word). Both sides are
     reduced to their stems first, so plurals and -ing/-ed forms come along automatically. */
  var SYN = {
    combine: 'merge', join: 'merge', unite: 'merge', concatenate: 'merge', append: 'merge', stitch: 'merge', fuse: 'merge',
    shrink: 'compress', reduce: 'compress', downsize: 'compress', squeeze: 'compress', minimize: 'compress', optimize: 'compress', optimise: 'compress', smaller: 'compress', lighter: 'compress',
    picture: 'image', pic: 'image', img: 'image', photo: 'image', photograph: 'image', selfie: 'image', snapshot: 'image', jpeg: 'jpg',
    screencap: 'screenshot', screengrab: 'screenshot', snip: 'screenshot',
    erase: 'remove', delete: 'remove', eliminate: 'remove', discard: 'remove', wipe: 'remove', rid: 'remove',
    conceal: 'hide', obscure: 'hide',
    censor: 'redact', blackout: 'redact', blacken: 'redact', mask: 'redact',
    sharpen: 'enhance', upscale: 'enhance', enlarge: 'enhance', unblur: 'enhance', sharper: 'enhance', clearer: 'enhance',
    divide: 'split', separate: 'split',
    payslip: 'paycheck', paystub: 'paycheck', paycheque: 'paycheck', paycheques: 'paycheck', payroll: 'paycheck', paid: 'pay',
    earnings: 'income', earn: 'income', money: 'income', receive: 'income',
    pension: 'retirement',
    equities: 'stock', equity: 'stock', etf: 'stock',
    cryptocurrency: 'crypto', bitcoin: 'crypto', btc: 'crypto', ethereum: 'crypto', eth: 'crypto', nft: 'crypto',
    cv: 'resume', curriculum: 'resume', vitae: 'resume',
    percentage: 'percent', pct: 'percent',
    gratuity: 'tip',
    pw: 'password', passwd: 'password',
    converter: 'convert', conversion: 'convert', transform: 'convert',
    tz: 'timezone', calc: 'calculator',
    prettify: 'format', beautify: 'format', beautifier: 'format',
    guid: 'uuid', colour: 'color', hexadecimal: 'hex', uri: 'url', urlencode: 'url',
    faker: 'dummy', mock: 'dummy', fake: 'dummy', placeholder: 'dummy',
    usa: 'us', america: 'us', american: 'us',
    england: 'uk', britain: 'uk', british: 'uk', scottish: 'scotland', australian: 'australia', aussie: 'australia', canadian: 'canada',
    vs: 'compare', versus: 'compare', comparison: 'compare',
    safe: 'private', safely: 'private', privacy: 'private',
    cost: 'price', pricing: 'price', fee: 'price',
    login: 'account', signin: 'account', signup: 'account', register: 'account', subscribe: 'account', subscription: 'account', membership: 'account',
    glitch: 'bug', crash: 'bug', broken: 'bug', wrong: 'bug', mistake: 'bug', error: 'bug',
    tutorial: 'manual', walkthrough: 'manual', documentation: 'manual',
    chatgpt: 'ai', gpt: 'ai', openai: 'ai', gemini: 'ai', claude: 'ai', llm: 'ai', bard: 'ai', copilot: 'ai', artificial: 'ai',
    counter: 'count', counting: 'count',
    dob: 'birth', born: 'birth', birthdate: 'birth',
    salaried: 'salary', yearly: 'annual', annually: 'annual',
    billing: 'invoice', billed: 'invoice',
    qrcode: 'qr',
    valid: 'validate', validity: 'validate', headshot: 'image', portrait: 'image', gone: 'remove', turn: 'convert', collect: 'store',
    stranger: 'person', bystander: 'person', passerby: 'person', pedestrian: 'person',
    robot: 'robotic',
    tx: 'texas', fl: 'florida', ny: 'new york', nyc: 'new york', nj: 'new jersey', nc: 'north carolina', sc: 'south carolina', tn: 'tennessee'
  };

  /* Words that only share a stem with a synonym above and mean something else: "unit" is not "unite" (merge), "guide" is not "guid" (uuid). */
  var NO_SYN = ['unit', 'units', 'guide', 'guides', 'guided', 'guiding'];

  /* Korean word pieces -> the English words the matcher understands. Matching is "contains",
     so "합치고" (merging) is caught by "합치". Visitors never see this table. */
  var KO = [
    ['합치', 'merge'], ['합쳐', 'merge'], ['합본', 'merge'], ['병합', 'merge'], ['이어붙', 'merge'], ['하나로', 'merge'], ['묶', 'merge'],
    ['분할', 'split'], ['나누', 'split'], ['쪼개', 'split'], ['잘라', 'split'], ['자르', 'split'], ['페이지', 'page'], ['추출', 'extract'],
    ['삭제', 'remove'], ['지우', 'remove'], ['제거', 'remove'], ['없애', 'remove'],
    ['배경', 'background'], ['누끼', 'remove background'], ['투명', 'transparent'],
    ['메타데이터', 'metadata'], ['작성자', 'author'],
    ['압축', 'compress'], ['용량', 'size'], ['줄이', 'compress'], ['줄여', 'compress'], ['축소', 'compress'], ['리사이즈', 'resize'], ['사이즈', 'size'], ['크기', 'size'], ['변환', 'convert'], ['바꾸', 'convert'], ['바꿔', 'convert'], ['포맷', 'format'], ['형식', 'format'],
    ['사진', 'image'], ['이미지', 'image'], ['그림', 'image'], ['스크린샷', 'screenshot'], ['캡처', 'screenshot'], ['캡쳐', 'screenshot'],
    ['가리', 'hide'], ['가려', 'hide'], ['마스킹', 'redact'], ['블랙아웃', 'redact'], ['검은', 'redact'], ['검게', 'redact'], ['주민', 'id number redact'], ['개인정보', 'personal information redact'], ['민감', 'sensitive'],
    ['모자이크', 'mosaic'], ['블러', 'blur'], ['흐리게', 'blur'], ['얼굴', 'face'], ['인물', 'person'],
    ['글자추출', 'ocr'], ['문자인식', 'ocr'], ['글자인식', 'ocr'], ['텍스트', 'text'], ['글자', 'character'], ['문자', 'character'], ['스캔', 'scan'], ['손글씨', 'handwriting'],
    ['화질', 'enhance quality'], ['해상도', 'resolution enhance'], ['선명', 'sharpen'], ['고화질', 'enhance quality'], ['확대', 'enlarge'], ['흐릿', 'blurry'],
    ['지우개', 'eraser'], ['물체', 'object'], ['사물', 'object'],
    ['화살표', 'arrow'], ['주석', 'annotate'], ['강조', 'highlight'], ['자르기', 'crop'], ['크롭', 'crop'], ['그리기', 'draw'],
    ['월급', 'paycheck salary'], ['급여', 'paycheck salary'], ['연봉', 'annual salary'], ['실수령', 'takehome paycheck'], ['세후', 'after tax paycheck'], ['세금', 'tax'], ['소득세', 'income tax'], ['시급', 'hourly'], ['주급', 'weekly paycheck'], ['보너스', 'bonus'], ['초과근무', 'overtime'],
    ['한국', 'korea'], ['일본', 'japan'], ['중국', 'china'], ['인도', 'india'], ['독일', 'germany'], ['프랑스', 'france'], ['영국', 'uk'], ['호주', 'australia'], ['캐나다', 'canada'], ['미국', 'us'], ['싱가포르', 'singapore'], ['베트남', 'vietnam'], ['태국', 'thailand'], ['필리핀', 'philippines'], ['브라질', 'brazil'], ['멕시코', 'mexico'],
    ['텍사스', 'texas'], ['캘리포니아', 'california'], ['뉴욕', 'new york'], ['플로리다', 'florida'], ['워싱턴', 'washington'], ['일리노이', 'illinois'], ['조지아', 'georgia'], ['뉴저지', 'new jersey'], ['매사추세츠', 'massachusetts'], ['버지니아', 'virginia'], ['펜실베이니아', 'pennsylvania'], ['오하이오', 'ohio'], ['애리조나', 'arizona'], ['콜로라도', 'colorado'], ['네바다', 'nevada'], ['오리건', 'oregon'], ['하와이', 'hawaii'], ['알래스카', 'alaska'],
    ['온타리오', 'ontario'], ['퀘벡', 'quebec'], ['런던', 'london'], ['시드니', 'sydney'], ['토론토', 'toronto'], ['밴쿠버', 'vancouver'],
    ['복리', 'compound interest'], ['적금', 'savings'], ['예금', 'savings'], ['부동산', 'real estate'], ['월세', 'rent'], ['전세', 'rent'], ['점검', 'check'], ['정리', 'format'], ['풀기', 'unlock'], ['풀어', 'unlock'],
    ['주택담보', 'mortgage'], ['모기지', 'mortgage'], ['주택대출', 'mortgage home loan'], ['주담대', 'mortgage'], ['집값', 'house'], ['월상환', 'monthly payment'], ['상환', 'payoff'], ['대출', 'loan'], ['이자', 'interest'],
    ['은퇴', 'retirement'], ['노후', 'retirement'], ['퇴직', 'retirement'], ['연금', 'retirement pension'],
    ['양도소득', 'capital gains tax'], ['양도세', 'capital gains tax'], ['양도', 'capital gains'], ['주식', 'stock'], ['코인', 'crypto'], ['비트코인', 'crypto'], ['투자', 'invest'], ['환율', 'currency exchange rate'], ['환전', 'currency exchange rate'],
    ['빚', 'debt'], ['부채', 'debt'], ['채무', 'debt'], ['카드값', 'credit card debt'], ['신용카드', 'credit card'],
    ['체질량', 'bmi'], ['비만', 'bmi obese'], ['과체중', 'bmi overweight'], ['칼로리', 'calorie'], ['기초대사', 'bmr calorie'], ['다이어트', 'diet calorie'], ['살빼', 'lose weight calorie'], ['체중', 'weight'], ['몸무게', 'weight'],
    ['이력서', 'resume'], ['자소서', 'cover letter'], ['자기소개서', 'cover letter'], ['커버레터', 'cover letter'], ['취업', 'job'], ['채용', 'job'], ['지원', 'application'], ['키워드', 'keyword'], ['공고', 'posting'],
    ['인보이스', 'invoice'], ['청구서', 'invoice'], ['견적', 'quote'], ['영수증', 'receipt'], ['계약서', 'contract'], ['큐알', 'qr'], ['큐아르', 'qr'], ['바코드', 'barcode'],
    ['글자수', 'word count'], ['단어수', 'word count'], ['문자수', 'word count'], ['세기', 'count'], ['분량', 'word count'], ['가독성', 'readability'], ['맞춤법', 'grammar spelling'], ['번역', 'translate'], ['요약', 'summarize'], ['표절', 'plagiarism'],
    ['인공지능', 'ai'], ['챗지피티', 'ai chatgpt'], ['어색', 'robotic smooth'], ['자연스럽', 'smooth natural'], ['사람처럼', 'human smooth'],
    ['나이', 'age'], ['만나이', 'age'], ['생일', 'birthday'], ['생년월일', 'birth age'], ['날짜', 'date'], ['일수', 'days between'], ['디데이', 'countdown'], ['며칠', 'days'],
    ['퍼센트', 'percent'], ['백분율', 'percent'], ['할인율', 'discount percent'], ['할인', 'discount'], ['증감', 'percent change'],
    ['팁', 'tip'], ['더치', 'split bill'], ['정산', 'split bill'], ['엔빵', 'split bill'], ['n빵', 'split bill'], ['식당', 'restaurant'],
    ['비밀번호', 'password'], ['암호', 'password'], ['비번', 'password'], ['랜덤', 'random'],
    ['단위', 'unit'], ['환산', 'unit convert'], ['평수', 'pyeong'], ['평형', 'pyeong'], ['제곱미터', 'square meters'], ['킬로', 'kg'], ['파운드', 'pounds'], ['섭씨', 'celsius'], ['화씨', 'fahrenheit'], ['마일', 'miles'],
    ['시차', 'time difference timezone'], ['시간대', 'timezone'], ['세계시간', 'timezone'], ['회의시간', 'meeting timezone'],
    ['제이슨', 'json'], ['정렬', 'format'], ['인코딩', 'encode'], ['디코딩', 'decode'], ['색상', 'color'], ['컬러', 'color'], ['색깔', 'color'], ['더미', 'dummy'], ['가짜', 'fake'], ['테스트데이터', 'dummy test data'],
    ['비디오', 'video'], ['동영상', 'video'], ['영상', 'video'], ['음악', 'audio music'], ['음성', 'audio'], ['녹음', 'audio'],
    ['엑셀', 'excel'], ['워드', 'word'], ['한글파일', 'hwp'], ['한글문서', 'hwp'], ['파워포인트', 'powerpoint'], ['피피티', 'ppt'],
    ['무료', 'free'], ['회원가입', 'signup account'], ['로그인', 'login account'], ['가격', 'price'], ['안전', 'safe private'], ['개인정보보호', 'private'], ['업로드', 'upload'], ['서버', 'upload'], ['저장', 'stored'],
    ['오류', 'bug'], ['버그', 'bug'], ['고장', 'bug'], ['문의', 'contact'], ['연락', 'contact'], ['제안', 'feedback'], ['건의', 'feedback'],
    ['사용법', 'manual'], ['설명서', 'manual'], ['매뉴얼', 'manual'],
    ['계산', 'calculator'], ['계산기', 'calculator'], ['비교', 'compare'], ['이사', 'relocate'], ['이직', 'job offer compare'],
    ['서명', 'sign signature'], ['사인', 'sign signature'], ['전자서명', 'esign signature'], ['주가', 'stock price'], ['가계부', 'budget expense'], ['예산', 'budget'], ['지출', 'expense'],
    ['암호화', 'encrypt password'], ['해제', 'unlock remove'], ['잠금', 'locked'], ['회전', 'rotate'], ['워터마크', 'watermark'], ['쪽번호', 'page numbers'], ['페이지번호', 'page numbers'],
    ['편집', 'edit'], ['수정', 'edit'], ['자막', 'subtitles'], ['양식', 'template'], ['파일', 'file'], ['한글', 'korean hangul'], ['한컴', 'hancom'],
    ['아이폰', 'iphone'], ['헤이크', 'heic'], ['파비콘', 'favicon'], ['웹피', 'webp'], ['제이피지', 'jpg'], ['피엔지', 'png'], ['피디에프', 'pdf']
  ];
  /* Korean filler that should simply be ignored. */
  var KO_STOP = ['싶어', '싶은', '싶습니다', '해주세요', '해줘', '해줄', '주세요', '알려', '도와', '도움', '하고', '하는', '합니다', '하려', '할때', '할려', '있나요', '있어', '있을', '어디', '뭐', '무엇', '이거', '그거', '제가', '저는', '내가', '나는', '우리', '좀', '같은', '해야', '됩니다', '되나요', '가능', '수있', '때', '대한', '관련', '위한', '에서', '으로', '에게', '합니', '해서', '해도', '하면', '하기', '으면', '어떻게', '방법', '하는법', '인가요', '인지', '는데', '입니다', '이에요', '예요', '하고싶'];

  /* Two-letter state codes. Only used when the question also talks about pay or tax, and never for codes that
     are everyday words (in, or, me, hi, ok, oh, id, la, ma, de, co, al). tx, fl, ny, nj, nc, sc and tn are in SYN. */
  var STATE_ABBR = {
    ak: 'alaska', ar: 'arkansas', az: 'arizona', ca: 'california', ct: 'connecticut', ga: 'georgia', ia: 'iowa', il: 'illinois', ks: 'kansas', ky: 'kentucky',
    md: 'maryland', mi: 'michigan', mn: 'minnesota', mo: 'missouri', ms: 'mississippi', mt: 'montana', nd: 'north dakota', ne: 'nebraska', nh: 'new hampshire',
    nm: 'new mexico', nv: 'nevada', pa: 'pennsylvania', ri: 'rhode island', sd: 'south dakota', ut: 'utah', va: 'virginia', vt: 'vermont', wa: 'washington',
    wi: 'wisconsin', wv: 'west virginia', wy: 'wyoming'
  };

  /* Short questions made only of filler words ("what's new") would match nothing, so they are rewritten first. */
  var PHRASES = [
    [/\bwhats new\b|\bwhat is new\b|\bwhat changed\b|\bwhat s new\b/, 'changelog updates'],
    [/\bwho (are you|made this|made it|built this|runs this|is behind)\b/, 'about creator'],
    [/\bcontact (us|you|support)\b/, 'contact feedback'],
    [/\b(is|are) (it|this|these|they) (safe|secure|private)\b/, 'private safe'],
    [/\b(is|are) (it|this|these|they) (really |actually |truly |totally |completely )?free\b|\bdo i (have to|need to) pay\b|\bhow much (does it|do they) cost\b|\b(do|does) (you|it|they) (charge|cost)\b|\bhidden (fees|costs|charges)\b/, 'free price'],
    [/\bhow (does|do) (it|this|the site|the tools?) work\b/, 'private upload'],
    [/\b(does not|doesnt|dont|do not|isnt|is not|not|wont|will not|cant|cannot|can not) (work|working|load|loading|open|opening|respond|responding)\b/, 'broken bug'],
    [/\btake home\b/, 'takehome'],
    [/\bafter tax(es)?\b/, 'takehome'],
    [/\bwhats your story\b|\btell me about (you|this site|the site|yourself)\b/, 'about creator'],
    [/\b(get|pull|extract|take|grab|copy|lift|read|retrieve|fetch)\s+(the\s+|all\s+the\s+|all\s+)?(words|text|writing|letters)\s+(out of|out|from|off|in|on|inside)\b/, 'extract text from'],
    [/\b(into|as|in|to) (one|a single|1|single) (file|pdf|document)\b|\b(want|need|make|get) (it |them )?(one|a single|1|single) (file|pdf|document)\b|\bsingle (file|pdf)\b/, 'merge together']
  ];

  /* Everyday English words the typo-corrector must leave alone (otherwise "place" becomes "plate" and "story" becomes "store").
     Made by a script from a word-frequency list: every common word that would have been "corrected" into one of our own words.
     Re-make it after adding many new tools or phrases; an out-of-date list only means a few more words get "corrected". */
  /* PROTECT-BEGIN */
  var PROTECT = (
    'accent accents accordingly accredited accurately accusation accusations accustomed activation admissions ' +
    'admittedly aggression albert alberto allocation along alteration alterations altogether amendments ample ' +
    'annals annexation anonymously apart apartment apartments appliances applicable arts asses assignment ' +
    'assignments assurances aston astounding attracting attraction attractions authorised authorized back backed ' +
    'backing backs baker balls banged banging bangs banking banks banned banning bans barge barking barnes barrow ' +
    'basel bases basic basics basil basin bass batch bates batting beads beak beans bearing bearings bears belle ' +
    'bells belongings bending bends berth billy binding binds birch blake blanc bland blank bleak bless blessed ' +
    'blessing blessings blink blinking block blocked blocking blocks bloke blowing blows blue blues bogus bonded ' +
    'bonding bonds bones bosses bound bounded bounds bourne bowie boyd brake brakes braking brand branded branding ' +
    'brands bread brits brody bucks built bulbs bulky bulls buried burke burner burnt burying butch byrne cable ' +
    'cables cache cage cages calming calves capita capitalize capitol carbs care cared cares caring carly caroline ' +
    'cars cart carts carve carved carving catchy categorized cells cents chan chance chances changer chant chanting ' +
    'chants char characterize charge charged charges charging charles charm charming charms chat chats chatting ' +
    'cheat cheated cheating cheats cheek cheeks cheng chick chicks ching chopped chopping chops chuck chung circa ' +
    'circulated circulating circulation claire clan clans cleanse cleansing clear cleared clearing clears click ' +
    'clicked clicking clicks clint cloak clover coast cock cocks colombia colon commenting companion companions ' +
    'compartment compassion complement compliment compliments compressor comprising conception concerning concert ' +
    'concerts conditions conducting congestion connecting connection connections conor consent constructed ' +
    'constructing construction containing containment contend contest contested contests context contexts ' +
    'continents continuing contract contracted contracting contraction contracts contributor contributors convent ' +
    'convention conventions conversation conviction convictions cope coping cords core cores corp corps correlated ' +
    'correlation corruption costa counties county court courts cove covert coveted crack cracked cracking cracks ' +
    'crate cream crease creature creatures crest crore cross crossed crosses crossing crossings crows crust cunt ' +
    'cunts customized dairy daisy daly darts dealing dealings deals dearly debate debated debates debating debit ' +
    'debut debuted debuts decade decades deceased decent decide decided decidedly decides deciding deco decor ' +
    'dedication defect defects definite definition definitions degenerate department departments deported ' +
    'depressing depression deprivation describing descriptive destination destinations destruction detachment ' +
    'detained detectives detention dicks differently dimensional diner directions director directorate directors ' +
    'distant distinction distinctions distract distracted distracting distraction distractions distribute ' +
    'distributed distributing distribution ditch divine dover dragged dragging drake drawn dread dreaded dropped ' +
    'dropping drops earl earrings ears easter educational eight elaine elle elves emerge emerged emerges emerging ' +
    'emission emissions employed employee employees employment empowering empowerment enact enacted encore ended ' +
    'ending endings equality estate estates exceptions exchanging excitement executions exemptions expectation ' +
    'expectations expedition expeditions experiment experiments expert experts exploiting extinction fails falling ' +
    'fallon fallout falls fandom farming farms feared fearing fears federation feeding feeds feeling feelings feels ' +
    'fiction filling finch firms flakes flame flames flaming flare flares flats flattering flawed flaws fleet ' +
    'fleeting fleets flesh flint flock flower flowering flowers focal folded folding folds fond forbes force forced ' +
    'forces forcing forge forged forgetting forging forks formal formulated formulation forth forum forums foster ' +
    'fostering foundation foundations fracking fragment fragments frame framed frames framing fraser freak freaked ' +
    'freaking freaks fried fund funded funding funds garde gavin geared gearing gears genera general generals ' +
    'georgian germs glide gloss gmail government governments grain grains grandparents grass great grows guild ' +
    'guise halls handed handing hands hang hanged hanging hangs hardest harding hare harper hart hatch headed ' +
    'header heading heads healed healing heals health hearing hearings hears heck heightened hicks hinted hints ' +
    'holding holdings holds honey horse horses hose hosted hosting hosts hound hovering hughes humanities iceland ' +
    'identified identifies identify identifying implements implicated implication implications impression ' +
    'impressions improvised inaccessible inaccurate incest indian indians indifference indifferent infections ' +
    'infested informal informant informative injections inland inner innovation innovations inscription ' +
    'inscriptions insecurity insensitive instructor instructors instrument instruments insulation intentions ' +
    'interacting interaction interactions intercepted interception intersection intervention invent invented ' +
    'invention inventions inverted involvement iphone iphones irrational itching jason jeans jesse joint jones kale ' +
    'kicked kicking kicks killing kilometres kissed kisses kissing lack lacked lacking lacks lacrosse lakers landed ' +
    'landing landings lands lane lanes larger latch late later latter laundering leader leaders leading leads lean ' +
    'leaned leaning learn lease leased leases leasing lending lends lengthy lenses lesions lester lever licence ' +
    'licences licking lifted lifting lifts limitation limitations liner liners listed listing listings lists lite ' +
    'litre litter liver loaded loading loads locate located locating location locations lock locke locked locking ' +
    'locks lodge lodged lodging logan logic lone loose lords loser losers lounge lover lovers loyal lumber lungs ' +
    'lure maher mail mailed mailing mails maize malice mall malls management mane manic manned manning mansion ' +
    'manuel march marched marches marching mare marginalized marie marine marines marion marker markers marrow ' +
    'mashed master mastered mastering masters matchup mater math maths mayer mclean meals meant meats medical ' +
    'medication medications meditation megan melted melting melts mention mentions menus mere merger messed messing ' +
    'milling misuse mitch mitigation moaning moines monkey mont monte monty monument monuments moth mound mount ' +
    'mounted mounting mounts mouse mouth mouths mummy narrow narrowed nasal nationally nearing nearly niche nigger ' +
    'norms novak oasis objectives obstruction occupation occupational occupations omission oppression overcoming ' +
    'packed packing packs pain pains paint painted painting paintings paints palate pants paper papers paris parked ' +
    'parking parks parsons particle particles parties party partying passed passes passing passion passions paste ' +
    'patch patches patio pats pearson pending penetrating penetration perception perceptions perfection persona ' +
    'personalized personally pests petty phase phased phases phony photon pickle pickles picky pike pills pinch ' +
    'pint pinterest pissed pisses pissing place placed placement places placing plaid plank planner planners plant ' +
    'planted planting plants plato played playing playoff playoffs plays plots plotted plotting poets point pointed ' +
    'pointing points poker polling polls pond ponds portion portions ports pose posed poses posing position ' +
    'positioned positioning positions positively potion pots poured pouring powder powdered predicting prediction ' +
    'predictions prescription presenting presume presumed preventing prevention pricey prick pride prime ' +
    'principally principle principles prize prized prizes proceed proceeds produce produced produces producing ' +
    'productive promotions prone properly proportion proportions props prosecuted prosecuting prosecution ' +
    'prosperity protect protected protecting protection protections protects protesting provisions pulse pulses ' +
    'qualified qualifies qualify qualifying quantities rack racket racks radio radios rained raining rains ' +
    'randomized ransom rational rationale react reacted reacting reaction reactions reacts ready realm realms ' +
    'reaper rebuilding reception recognise recognised recognition recordings recover recovered recovering ' +
    'recreation recreational rector recurring reduction reductions reformation regal regeneration regent regulating ' +
    'regulation regulations regulators relaxation relegation reliability reliably remote renal render rendered ' +
    'rendering renders renovation renovations rented renting rents repeatedly repent replay replication repost ' +
    'reproduction requirement requirements resent resentment reset reside resided resides residing resin resort ' +
    'resorts respecting restoration restricted restricting restriction restrictions retail retention revolution ' +
    'revolutions rice ridden rite rites roads robes rode rope ropes ross round rounded rounder rounding rounds ' +
    'rover rovers rust sack sacked sacks safer sailor sailors sands sane saturation scale scaled scales scaling ' +
    'scams scare scared scares scars scattering scene scenes scent scented scope scorer scorpion scots scratching ' +
    'sealed sealing seals sears seated seating seats section sections seeded seeds seeking seeks selections selves ' +
    'senate sensational sense sensed senses sensing sensor sentiment sentiments separately sequencing serve served ' +
    'serves session sessions setting settings settlement settlements severe severed shack shady shake shakes ' +
    'shaking shale shame shaming shane shark sharks sharp shave shaved shaving shear sheds shell shells shipment ' +
    'shipments shipped shipping ships shire shirt shirts shock shocked shocking shocks shoot shooting shootings ' +
    'shoots shopping shops shore shores shot shots shout shouted shouting shouts shred shrine shrubs sidney sighs ' +
    'sing singing sings sinking sinks sinner sinners situations skate skating slack slain slapped slapping slate ' +
    'slated slit sloan slower smack smell smelled smelling smells snack snacks snapped snapping snaps snatch ' +
    'snatched sniff soaring sock socks sole solid solids solos songs soothing sore soul souls sour spade spanning ' +
    'spans spare spared specialised specialized specializes specializing specialties spectators spell spelled ' +
    'spelling spells spend spending spends spent spit spite spitting sport sporting sports sprint stabbed stabbing ' +
    'stacy staff staffed staffing stage staged stages staging stake stakes stale stalk stalking stall stalled ' +
    'stalls standardized stare stared stares staring stark starred starring stars start started starting starts ' +
    'staten statue statues status stayed staying stays steep stems steph steve stick sticking sticks stirred ' +
    'stirring stoke stoked stokes stole stony stopped stopping stops storey storm stormed storms stormy stove ' +
    'strange strap strapped straps stride strides strife strike strikes striking strive striving stronger strung ' +
    'stuck studs stunned stunning subjective superb supper supplement supplements supporters supportive supposedly ' +
    'surprising surprisingly swamp swans sweet sweets swell swelling swipe switch switched switches switching sword ' +
    'swords swore synonymous tack tape taped tapes taste tasted tastes tasting tate taylor teaches teamed teaming ' +
    'teams tearing tears temptation tended tends tension tents terrifying territorial testament texans thigh thighs ' +
    'thrust ticking ticks token tokens tore tories torment tory tossed tossing toured touring tourism tours tower ' +
    'towers trace traced traces tracing tract traction tracy traditions trail trailing trails transparency tread ' +
    'treat treated treating treatment treatments treats tribal trick tricked tricks triggering trillion trip triple ' +
    'tripped tripping trips truck trucking trucks trustee trustees tube tubes tummy tune turin understood ' +
    'unexpected unexpectedly unreliable usher variations vending vents venue venues verge verses vested viewed ' +
    'violations vital vocal vocals vocational waited waiting waits walled walls wards waste wasted wastes wasting ' +
    'watch watched watches watching wealthy wearing wears weeds weeping weigh weighed weighing weighs white whites ' +
    'wicked wife winner winners withheld wooded woods wore worms worse worthy wound wounded wounds wright wrist ' +
    'wrists writer wrote yards yelled yelling yells youth youths yummy zhang'
  ).replace(/\s+/g, ' ');
  /* PROTECT-END */

  /* Topic rules: their trigger words are often just the kind of document someone is working on ("split my lease pdf",
     "blur my tax return", "compress my receipt photos"). When one of our tools plainly does the job, the topic is context. */
  ['real-estate', 'business-other', 'career-other', 'health-other', 'benefits-other', 'invest-calc', 'tax-filing', 'tax-self-employed', 'tax-other', 'budget', 'website-seo'].forEach(function (id) {
    gaps.forEach(function (g) { if (g.id === id) g.ctx = true; });
  });

  root.PPM_HELP_INDEX = {
    version: 1,
    protect: PROTECT,
    tools: tools,
    gaps: gaps,
    stop: STOP,
    soft: SOFT,
    syn: SYN,
    noSyn: NO_SYN,
    ko: KO,
    koStop: KO_STOP,
    stateAbbr: STATE_ABBR,
    phrases: PHRASES,
    examples: [
      'Merge two PDFs into one',
      'Take-home pay in Texas',
      'Make a photo smaller to email it',
      'Black out an ID number in a PDF',
      'Monthly mortgage payment',
      'Blur faces in a group photo',
      'Does my resume match this job?',
      'Split a restaurant bill'
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PPM_HELP_INDEX;
})(typeof window !== 'undefined' ? window : globalThis);
