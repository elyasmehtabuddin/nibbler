"use strict";

function NewEngine() {

	return {

		exe: null,
		readyok_required: 0,
		warned: false,
		scanner: null,
		err_scanner: null,
		log_info_lines: false,

		send: function(msg) {

			if (!this.exe) {
				return;
			}

			try {
				msg = msg.trim();
				this.exe.stdin.write(msg);
				this.exe.stdin.write("\n");
				Log("--> " + msg);
			} catch (err) {
				Log("(failed) --> " + msg);
				if (this.exe.connected === false && !this.warned) {
					this.warned = true;
					alert("The engine appears to have crashed.");
				}
			}
		},

		setoption: function(name, value) {
			this.send(`setoption name ${name} value ${value}`);
		},

		// The sync function exists so that we can disregard all output until a certain point.
		// Basically we use it after sending a position, so that we can ignore all analysis
		// that comes until LZ sends "readyok" in response to our "isready". All output before
		// that moment would refer to the obsolete position.
		//
		// While this seems to work correctly with Lc0, tests with Stockfish show that it
		// definitely violates our assumptions and sends things out of order, hence the need
		// for validity checking on incoming messages anyway.

		sync: function() {
			this.send("isready");
			this.readyok_required++;
		},

		setup: function(path, receive_fn, err_receive_fn, log_info_lines) {

			// This is slightly sketchy, the passed functions get saved to our engine
			// object in a way that makes them look like methods of this object. Hmm.

			this.receive_fn = receive_fn;
			this.err_receive_fn = err_receive_fn;

			this.log_info_lines = log_info_lines;

			this.exe = child_process.spawn(path);
			this.exe.on("error", (err) => {
				alert("Couldn't spawn process - check the path in the config file");	// Note that this alert will come some time in the future, not instantly.
			});

			this.scanner = readline.createInterface({
				input: this.exe.stdout,
				output: undefined,
				terminal: false
			});

			this.err_scanner = readline.createInterface({
				input: this.exe.stderr,
				output: undefined,
				terminal: false
			});

			this.err_scanner.on("line", (line) => {
				Log("! " + line);
				this.err_receive_fn(line);
			});

			this.scanner.on("line", (line) => {

				// We want to ignore all output when waiting for readyok

				if (line.includes("readyok") && this.readyok_required > 0) {
					this.readyok_required--;
				}

				if (this.readyok_required > 0) {
					if (this.log_info_lines || line.includes("info") === false) {
						Log("(ignored) < " + line);
					}
					return;
				}

				if (this.log_info_lines || line.includes("info") === false) {
					Log("< " + line);
				}
				this.receive_fn(line);
			});
		}
	};
}
