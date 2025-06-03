
# How to Create PDF from HTML

Since PDF generation requires browser dependencies not available in this environment, 
follow these steps to create a PDF version:

## Method 1: Browser Print
1. Open 'Promellon-User-Guide.html' in your web browser
2. Press Ctrl+P (Windows/Linux) or Cmd+P (Mac)
3. Select "Save as PDF" as the destination
4. Choose appropriate settings:
   - Paper size: A4
   - Margins: Normal
   - Options: Include backgrounds
5. Save as 'Promellon-User-Guide.pdf'

## Method 2: Online PDF Converter
1. Upload 'Promellon-User-Guide.html' to an online HTML-to-PDF converter
2. Download the generated PDF

## Method 3: Command Line (if wkhtmltopdf is available)
```bash
wkhtmltopdf --page-size A4 --margin-top 20mm --margin-bottom 20mm Promellon-User-Guide.html Promellon-User-Guide.pdf
```

The HTML file is fully formatted and ready for conversion to PDF.
