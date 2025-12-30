const fs = require('fs');
const content = fs.readFileSync('src/js/main.js', 'utf8');

let stack = [];
let line = 1;
let col = 1;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') stack.push({ line, col });
    if (char === '}') {
        if (stack.length > 0) {
            stack.pop();
        } else {
            console.log(`Extra closing brace at ${line}:${col}`);
        }
    }

    if (char === '\n') {
        line++;
        col = 1;
    } else {
        col++;
    }
}

console.log('Unclosed braces:');
stack.forEach(s => console.log(`  at ${s.line}:${s.col}`));
console.log(`Total unclosed: ${stack.length}`);
