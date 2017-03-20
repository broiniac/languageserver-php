const cp   = require("child_process");
const path = require("path");
const fs   = require("fs");
const net  = require("net");
const rpc  = require("vscode-jsonrpc");
const os   = require("os");
const {AutoLanguageClient, DownloadFile} = require("atom-languageclient");

class PhpLanguageServer extends AutoLanguageClient {
	getGrammarScopes() { return ["source.php"] ; }
	getLanguageName()  { return "PHP"          ; }
	getServerName()    { return "PHP-Server"   ; }

	/**
	 * {@inheritDoc}
	 */
	constructor() {
		super();

		this.socket          = null;
		this.indexerLength   = 0;
		this.vendors         = path.join("/", os.homedir(), ".composer", "vendor");
		this.server          = path.join(this.vendors, "felixfbecker", "language-server");
		this.progressElement = document.createElement("div");
		this.progressElement.className = ".progress-bar";
	}

	/**
	 * {@inheritDoc}
	 */
	startServerProcess() {
		return this.fileExists(this.server).then((exists) => {
			// If the Composer packages exists, just return a new server
			if (exists) {
				return this.spawnServer();
			}

			// Otherwise, we have to require it and compile stubs
			// TODO
			throw Error("Have to be installed via Composer")
		});
	}

	/**
	 * Assert that a path exists
	 *
	 * @param  string path
	 * @return Promise
	 */
	fileExists(path) {
		return new Promise((resolve, reject) => {
			fs.access(path, fs.R_OK, (error) => resolve(!error || error.code !== "ENOENT"));
		});
	}

	/**
	 * Spawn our PHP server
	 */
	spawnServer() {
		// Define global scoped method to generate our child process
		const spawn = () => {
			return cp.spawn("php", [path.join("bin", "php-language-server.php")], { cwd : this.server });
		};

		// Use a Promise in order to resolve the window STDIO blocking
		return new Promise((resolve, reject) => {
			// Causes the server to use a tcp connection for communicating with
			// the language client instead of using STDIN/STDOUT. The server
			// will try to connect to the specified address.
			//
			// Strongly recommended on Windows because of blocking STDIO.
			if (process.platform == "win32") {
				// As we only want one connection, we have to create our server
				// and close it right after : it keeps alive connections but
				// rejects others
				const server = net.createServer((socket) => {
					// We don't need the server : only the socket
					server.close();

					this.socket = socker;
					this.updateStatusBar("Starting socket server");

					resolve(spawn());
				})

				// Listen on our server on a random port and fixes args list
				server.listen(0, "127.0.0.1", () => {
					args.push("--tcp=127.0.0.1:" + server.address().port);
				});
			}

			// Others OS
			else {
				this.updateStatusBar("Starting stdin/stdout server");

				resolve(spawn());
			}
		});
	}

	/**
	 * As we want to manage the socket server and stdin/stdout, we have to
	 * manage both cases
	 *
	 * @override
	 */
	createServerConnection() {
		// Prevent empty socket or process
		if (this.socket == null && this._process == null) {
			throw Error(`Process or socket must be set before calling RPC
			connection to server process`);
		}

		// If socket exists, use it. Otherwise, handle the process stdin/stdout
		const stdin  = (this.socket) ? this.socket : this._process.stdin;
		const stdout = (this.socket) ? this.socket : this._process.stdout;

		return rpc.createMessageConnection(
			new rpc.StreamMessageReader(stdout),
			new rpc.StreamMessageWriter(stdin),

			{
				error : (m) => { this.logger.error(m); }
			}
		);
	}

	/**
	 * This method returns a selector to `.source` and we want use `source.php`
	 * and also remove autocomplete on comments
	 *
	 * @override
	 */
	provideAutocomplete() {
		return {
			selector             : ".source.php",
			disableForSelector   : "source.php .comment",
			getSuggestions       : this.getSuggestions.bind(this),
			inclusionPriority    : 1,
			excludeLowerPriority : true,
			suggestionPriority   : 2,
		};
	}

	/**
	 * Setting up progress bar to index files
	 */
	preInitialization() {
		const states = {
			"start" : /^(\d+) files total$/i,
			"parse" : /^parsing (.*)$/i,
			"ended" : /^all (\d+) php files parsed in \d+ seconds. \d+ mib allocated.$/i,
		};

		// Index files are present in log messages, so let's just parse them
		this._lc.onLogMessage((message) => {
			const data = message.message;

			Object.keys(states).map((state, index) => {
				const pattern = states[state];
				const matches = data.match(pattern);

				if (matches) {
					const value = matches[1];

					switch (state) {
						case "start" : this.incrementProgressBar(value) ; break;
						case "parse" : this.incrementProgressBar(value) ; break;
						case "ended" : this.updateStatusBar(matches[0]) ; break;
  					}
				}
			});
		})
	}

	/**
	 * Increment progress bar
	 */
	incrementProgressBar(current) {
		this.updateStatusBar(`Parsing ${current}`);
	}

	/**
	 * Update status bar
	 *
	 * @param string text
	 */
	updateStatusBar (text) {
		this.progressElement.textContent = `${this.name} ${text}`;
	}

	/**
	 * Consume statusBar provider
	 *
	 * @param statusBar statusBar
	 */
	consumeStatusBar(statusBar) {
		this.statusTile = statusBar.addRightTile({ item: this.progressElement, priority: 1000 });
	}

	/**
	 * As we consume the statusBar API, we have to shutdown it on deactivate
	 */
	deactivate() {
		this.statusTile.destroy();
		this.statusTile = null;

		// Call the parent deactivate method
		super.deactivate();
	}
}

module.exports = new PhpLanguageServer();
