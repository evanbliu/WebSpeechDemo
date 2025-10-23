document.addEventListener('DOMContentLoaded', () => {

    // Get all the DOM elements
    const langInput = document.getElementById('lang-input');
    const processLocallyCheck = document.getElementById('process-locally-check');
    const codeDisplay = document.getElementById('code-display');
    const audioSource = document.getElementById('audio-source');
    const executeBtn = document.getElementById('execute-btn');
    const checkAvailabilityBtn = document.getElementById('check-availability-btn');
    const installBtn = document.getElementById('install-btn');
    const addPhraseBtn = document.getElementById('add-phrase-btn');
    const phrasesContainer = document.getElementById('phrases-container');
    const outputEl = document.getElementById('output');

    // --- 1. UI and Code Generation ---

    function createPhraseRow() {
        const row = document.createElement('div');
        row.className = 'phrase-row';
        row.innerHTML = `
            <input type="text" class="phrase-input" placeholder="e.g., Gemini Code Assist" title="Phrase">
            <input type="text" class="boost-input" value="1.0" title="Boost value">
            <button class="remove-phrase-btn">×</button>
        `;
        phrasesContainer.appendChild(row);
        row.querySelector('.remove-phrase-btn').addEventListener('click', () => {
            row.remove();
            generateCode();
        });
        // Re-generate code when inputs change
        row.querySelector('.phrase-input').addEventListener('input', generateCode);
        row.querySelector('.boost-input').addEventListener('input', generateCode);
    }
    
    function generateCode() {
        const lang = langInput.value;
        const isProcessLocally = processLocallyCheck.checked;

        const phraseRows = phrasesContainer.querySelectorAll('.phrase-row');
        const phrasesCode = Array.from(phraseRows).map(row => {
            const phrase = row.querySelector('.phrase-input').value.trim();
            const boost = parseFloat(row.querySelector('.boost-input').value) || 1.0;
            return phrase ? `        new SpeechRecognitionPhrase("${phrase.replace(/"/g, '\\"')}", ${boost})` : '';
        }).filter(Boolean).join(',\n    ');

        // Use a template literal to build the JS code string
        const codeTemplate = `
// Get the output element from the page
const output = document.getElementById('output');
output.innerHTML = "<p>Initializing speech recognition...</p>";

try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechRecognitionPhrase = window.SpeechRecognitionPhrase || window.webkitSpeechRecognitionPhrase;
    
    if (!SpeechRecognition) {
        output.innerHTML = "<p>Error: Speech Recognition API is not supported in this browser.</p>";
        return;
    }

    const recognition = new SpeechRecognition();

    // --- Options Set by You ---
    recognition.lang = "${lang}";
    recognition.processLocally = ${isProcessLocally};
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.phrases = SpeechRecognitionPhrase ? [
${phrasesCode}
    ] : [];
    // --------------------------

    recognition.onstart = () => {
        output.innerHTML = "<p>Listening... Speak into your microphone.</p>";
    };

    recognition.onresult = (event) => {
        let transcript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        
        output.innerHTML = \`
            <p><strong>Transcript:</strong> \${transcript}</p>
        \`;
    };

    recognition.onerror = (event) => {
        output.innerHTML = \`<p><strong>Error:</strong> \${event.error}</p>\`;
    };

    recognition.onend = () => {
        if (!${isProcessLocally}) {
            output.innerHTML += "<p>(Recognition finished)</p>";
        } else {
             output.innerHTML += "<p>(Restarting...)</p>";
        }
    };

    // Start the recognition
    recognition.start();

} catch (e) {
    output.innerHTML = \`<p>An execution error occurred: \${e.message}</p>\`;
    console.error(e);
}
`;
        // Set the text of the code block (trim whitespace)
        codeDisplay.textContent = codeTemplate.trim();
    }

    // --- 2. Execution Logic ---
    
    function executeCode() {
        // Get the *current* text from the editable code block
        const userCode = codeDisplay.textContent;

        // --- SECURITY WARNING ---
        // Using new Function() is safer than eval() as it runs in its
        // own scope, but it's still executing arbitrary user code.
        // This is fine for a personal playground but not for production
        // with untrusted users.
        try {
            const F = new Function(userCode);
            F();
        } catch (e) {
            outputEl.innerHTML = `<p><strong>Execution Error:</strong> ${e.message}</p>`;
            console.error(e);
        }
    }

    // --- 2b. Function to Execute with Audio Track ---
    async function executeWithAudioTrack() {
        const output = document.getElementById('output');
        output.innerHTML = "<p>Initializing speech recognition with audio track...</p>";

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                output.innerHTML = "<p>Error: Speech Recognition API is not supported.</p>";
                return;
            }

            // Capture the stream from the audio element
            const stream = audioSource.captureStream ? audioSource.captureStream() : audioSource.mozCaptureStream();
            const audioTracks = stream.getAudioTracks();

            if (audioTracks.length === 0) {
                output.innerHTML = "<p>Error: Could not find an audio track in the media element.</p>";
                return;
            }

            // This is the correct implementation: create a standard recognition object.
            const recognition = new SpeechRecognition();
            const audioTrack = audioTracks[0];

            // Get phrases from the UI
            const SpeechRecognitionPhrase = window.SpeechRecognitionPhrase || window.webkitSpeechRecognitionPhrase;
            const phrases = SpeechRecognitionPhrase ? Array.from(phrasesContainer.querySelectorAll('.phrase-row')).map(row => {
                const phrase = row.querySelector('.phrase-input').value.trim();
                const boost = parseFloat(row.querySelector('.boost-input').value) || 1.0;
                // Use the constructor to create a proper SpeechRecognitionPhrase object
                return phrase ? new SpeechRecognitionPhrase(phrase, boost) : null;
            }).filter(Boolean) : [];


            // Re-implement the logic from generateCode, but for the audio track.
            // This is more robust than string manipulation.
            recognition.lang = langInput.value;
            recognition.processLocally = processLocallyCheck.checked;
            recognition.interimResults = true;
            recognition.continuous = true;
            recognition.phrases = phrases;

            recognition.onstart = () => {
                output.innerHTML = "<p>Listening to audio track...</p>";
            };

            recognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    transcript += event.results[i][0].transcript;
                }
                
                output.innerHTML = `
                    <p><strong>Transcript:</strong> ${transcript}</p>
                `;
            };

            recognition.onerror = (event) => {
                output.innerHTML = `<p><strong>Error:</strong> ${event.error}</p>`;
            };

            recognition.onend = () => {
                output.innerHTML += "<p>(Audio track recognition finished)</p>";
            };

            // The correct way to start recognition with a track is via the start() method.
            recognition.start(audioTrack);
        } catch (e) {
            output.innerHTML = `<p>An execution error occurred: ${e.message}</p>`;
            console.error(e);
        }
    }

    // --- 2c. Functions for On-Device Model Management ---
    async function checkAvailability() {
        const lang = langInput.value;
        outputEl.innerHTML = `<p>Checking availability for on-device model [${lang}]...</p>`;

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition.available) {
                outputEl.innerHTML = `<p>Error: SpeechRecognition.available() is not supported in this browser.</p>`;
                return;
            }

            const availability = await SpeechRecognition.available({ processLocally: true, langs: [lang] });
            
            outputEl.innerHTML = `<p><strong>Availability for [${lang}]:</strong> ${availability}</p>`;

        } catch (e) {
            outputEl.innerHTML = `<p>An error occurred while checking availability: ${e.message}</p>`;
            console.error(e);
        }
    }

    async function installModel() {
        const lang = langInput.value;
        outputEl.innerHTML = `<p>Starting installation for on-device model [${lang}]...</p>`;

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition.install) {
                outputEl.innerHTML = `<p>Error: SpeechRecognition.install() is not supported in this browser.</p>`;
                return;
            }

            const installed = await SpeechRecognition.install({ processLocally: true, langs: [lang] });

            if (installed) {
                outputEl.innerHTML = `<p><strong>Success!</strong> Model for [${lang}] has been installed.</p>`;
            } else {
                outputEl.innerHTML = `<p><strong>Installation Failed.</strong> The model for [${lang}] could not be installed. The browser may provide more details in the console.</p>`;
            }
        } catch (e) {
            outputEl.innerHTML = `<p>An error occurred while starting installation: ${e.message}</p>`;
            console.error(e);
        }
    }

    // --- 3. Attach Event Listeners ---

    // Update the code block whenever an option changes
    langInput.addEventListener('input', generateCode);
    processLocallyCheck.addEventListener('input', generateCode);
    addPhraseBtn.addEventListener('click', createPhraseRow);

    // Attach event listeners
    executeBtn.addEventListener('click', executeCode);
    checkAvailabilityBtn.addEventListener('click', checkAvailability);
    installBtn.addEventListener('click', installModel);
    audioSource.addEventListener('play', executeWithAudioTrack);
    

    // --- 4. Initial Call ---
    // Generate the code for the first time on page load
    generateCode();
});