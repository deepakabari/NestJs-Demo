import * as fs from 'fs';
import * as path from 'path';
import { WelcomeTemplate } from './welcome';

// Simulate the logic from EmailService
const interpolate = (template: string, variables: Record<string, string>): string => {
  return template.replace(/{{(\w+)}}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
};

const context = {
  name: 'John Doe',
  loginUrl: 'http://localhost:3000/login',
};

const fullHtml = interpolate(WelcomeTemplate.HtmlPart, context);

const outputPath = path.join(__dirname, 'rendered-example.html');
fs.writeFileSync(outputPath, fullHtml);

console.log(`Preview HTML generated at: ${outputPath}`);
