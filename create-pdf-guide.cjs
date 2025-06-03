const fs = require('fs');
const htmlPdf = require('html-pdf-node');

async function createUserGuidePDF() {
  console.log('Creating user guide PDF...');
  
  // Read the markdown content
  const markdownContent = fs.readFileSync('user-guide.md', 'utf8');
  
  // Convert markdown to HTML
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Promellon Task Management System - User Guide</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: white;
        }
        
        h1 {
            color: #1e40af;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 15px;
            margin-bottom: 30px;
            font-size: 2.5em;
            font-weight: 700;
        }
        
        h2 {
            color: #1e40af;
            margin-top: 40px;
            margin-bottom: 20px;
            font-size: 1.8em;
            font-weight: 600;
            border-left: 4px solid #3b82f6;
            padding-left: 15px;
        }
        
        h3 {
            color: #1e3a8a;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.3em;
            font-weight: 600;
        }
        
        h4 {
            color: #374151;
            margin-top: 25px;
            margin-bottom: 10px;
            font-size: 1.1em;
            font-weight: 600;
        }
        
        p {
            margin-bottom: 16px;
            text-align: justify;
        }
        
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', Monaco, monospace;
            font-size: 0.9em;
            color: #1f2937;
        }
        
        pre {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        ul, ol {
            margin: 16px 0;
            padding-left: 30px;
        }
        
        li {
            margin: 8px 0;
            line-height: 1.5;
        }
        
        .feature-section {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            border-left: 4px solid #10b981;
        }
        
        .note {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            border-left: 4px solid #f59e0b;
        }
        
        .note strong {
            color: #92400e;
        }
        
        .warning {
            background: #fef2f2;
            border: 1px solid #fca5a5;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            border-left: 4px solid #ef4444;
        }
        
        .toc {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 25px;
            margin: 30px 0;
        }
        
        .toc h2 {
            margin-top: 0;
            color: #1f2937;
            font-size: 1.5em;
        }
        
        .toc ul {
            list-style-type: none;
            padding-left: 0;
        }
        
        .toc li {
            margin: 8px 0;
            padding-left: 20px;
            position: relative;
        }
        
        .toc li:before {
            content: "▶";
            position: absolute;
            left: 0;
            color: #3b82f6;
        }
        
        .toc a {
            text-decoration: none;
            color: #3b82f6;
            font-weight: 500;
        }
        
        .toc a:hover {
            text-decoration: underline;
        }
        
        .step-box {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 8px;
            padding: 16px;
            margin: 15px 0;
            border-left: 4px solid #10b981;
        }
        
        .step-box h4 {
            margin-top: 0;
            color: #047857;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        th, td {
            border: 1px solid #e5e7eb;
            padding: 12px 16px;
            text-align: left;
        }
        
        th {
            background: #f9fafb;
            font-weight: 600;
            color: #374151;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .header-logo {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .feature-highlight {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin: 25px 0;
            text-align: center;
        }
        
        .feature-highlight h3 {
            color: white;
            margin-top: 0;
        }
        
        .system-requirements {
            background: #fffbeb;
            border: 1px solid #fed7aa;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }
        
        .system-requirements h3 {
            color: #92400e;
            margin-top: 0;
        }
        
        @media print {
            body {
                font-size: 12pt;
                line-height: 1.4;
            }
            
            h1 {
                font-size: 20pt;
            }
            
            h2 {
                font-size: 16pt;
                page-break-after: avoid;
            }
            
            h3 {
                font-size: 14pt;
                page-break-after: avoid;
            }
            
            .page-break {
                page-break-before: always;
            }
            
            .feature-section, .note, .warning, .step-box {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header-logo">
        <h1>📋 Promellon Task Management System</h1>
        <p style="font-size: 1.2em; color: #6b7280; margin-top: -10px;">Complete User Guide</p>
    </div>
    
    ${convertMarkdownToHTML(markdownContent)}
    
    <div class="page-break"></div>
    <div style="text-align: center; margin-top: 50px; color: #6b7280;">
        <p><strong>End of User Guide</strong></p>
        <p>For technical support, contact your system administrator</p>
        <p style="font-size: 0.9em;">Generated on ${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>`;

  const options = {
    format: 'A4',
    margin: {
      top: '25mm',
      bottom: '25mm',
      left: '20mm',
      right: '20mm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 10px; width: 100%; text-align: center; color: #666; padding: 0 20px;">
        <span>Promellon Task Management System - User Guide</span>
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 10px; width: 100%; text-align: center; color: #666; padding: 0 20px;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `
  };

  try {
    console.log('Converting to PDF...');
    const file = { content: htmlContent };
    const pdfBuffer = await htmlPdf.generatePdf(file, options);
    
    fs.writeFileSync('Promellon-User-Guide.pdf', pdfBuffer);
    console.log('✅ PDF generated successfully: Promellon-User-Guide.pdf');
    
    // Also create an HTML version for preview
    fs.writeFileSync('Promellon-User-Guide.html', htmlContent);
    console.log('✅ HTML version created: Promellon-User-Guide.html');
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
  }
}

function convertMarkdownToHTML(markdown) {
  let html = markdown;
  
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Convert bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Convert inline code
  html = html.replace(/\`([^`]+)\`/g, '<code>$1</code>');
  
  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Convert unordered lists
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^  - (.*$)/gim, '<li style="margin-left: 20px;">$1</li>');
  
  // Convert ordered lists
  html = html.replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>');
  
  // Wrap consecutive list items in ul/ol tags
  html = html.replace(/(<li>.*?<\/li>)/gs, function(match) {
    return '<ul>' + match + '</ul>';
  });
  
  // Clean up multiple ul tags
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  // Convert line breaks to paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraphs
  html = '<p>' + html + '</p>';
  
  // Fix broken paragraph tags around headers and lists
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ol>)/g, '$1');
  html = html.replace(/(<\/ol>)<\/p>/g, '$1');
  
  // Add special styling for specific sections
  html = addSpecialSections(html);
  
  return html;
}

function addSpecialSections(html) {
  // Add feature highlights
  html = html.replace(
    /<h2>Key Features<\/h2>/,
    '<div class="feature-highlight"><h2>🌟 Key Features</h2></div>'
  );
  
  // Add system requirements box
  html = html.replace(
    /<h3>System Requirements<\/h3>/,
    '<div class="system-requirements"><h3>💻 System Requirements</h3>'
  );
  html = html.replace(
    /(<div class="system-requirements">.*?)<h3>/s,
    '$1</div><h3>'
  );
  
  // Add step boxes for procedures
  const stepSections = [
    'Creating a New Task',
    'Editing Tasks',
    'Creating Projects',
    'Starting Direct Conversations',
    'Uploading Files'
  ];
  
  stepSections.forEach(section => {
    html = html.replace(
      new RegExp(`<h3>${section}</h3>`, 'g'),
      `<div class="step-box"><h4>📋 ${section}</h4>`
    );
  });
  
  // Add notes for important information
  html = html.replace(
    /\*Note: (.*?)\*/g,
    '<div class="note"><strong>📝 Note:</strong> $1</div>'
  );
  
  // Add warnings for admin features
  html = html.replace(
    /\*Note: These features are only available to users with administrator privileges\.\*/,
    '<div class="warning"><strong>⚠️ Administrator Only:</strong> These features are only available to users with administrator privileges.</div>'
  );
  
  return html;
}

// Run the PDF generation
createUserGuidePDF().catch(console.error);