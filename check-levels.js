const fs = require('fs');
const content = fs.readFileSync('src/js/main.js', 'utf8');

let stack = [];
let line = 1;
let col = 1;
let inString = null; // ' or " or `
let inComment = null; // // or /*

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inComment === '//') {
        if (char === '\n') inComment = null;
    } else if (inComment === '/*') {
        if (char === '*' && next === '/') {
            inComment = null;
            i++;
        }
    } else if (inString) {
        if (char === '\\') i++;
        else if (char === inString) inString = null;
    } else {
        if (char === '/' && next === '/') inComment = '//';
        else if (char === '/' && next === '*') {
            inComment = '/*';
            i++;
        }
        else if (char === "'" || char === '"' || char === '`') inString = char;
        else if (char === '{' || char === '(' || char === '[') stack.push({ char, line, col });
        else if (char === '}' || char === ')' || char === ']') {
            if (stack.length === 0) {
                console.log(`Extra ${char} at ${line}:${col}`);
            } else {
                const top = stack.pop();
                const match = { '}': '{', ')': '(', ']': '[' }[char];
                if (top.char !== match) {
                    console.log(`Mismatched ${char} at ${line}:${col} (expected match for ${top.char} from ${top.line}:${top.col})`);
                }
            }
        }
    }

    if (char === '\n') {
        line++;
        col = 1;
    } else {
        col++;
    }
}

if (inString) console.log(`Unclosed string ${inString}`);
if (inComment) console.log(`Unclosed comment ${inComment}`);
console.log('Unclosed stacks:');
stack.forEach(s => console.log(`  ${s.char} at ${s.line}:${s.col}`));
