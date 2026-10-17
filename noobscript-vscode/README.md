# NoobScript for VS Code

Language support for [NoobScript](https://www.npmjs.com/package/noobscript-lang), the programming language that uses gaming slang as its syntax.

## Features

- Syntax highlighting for `.noob` files
- A NoobScript file icon
- **▶ Run** button in the editor title bar (or `Ctrl+F5`, or right-click a `.noob` file → *Run NoobScript File*)
- Comment toggling (`Ctrl+/`), bracket matching, auto-indent

## Requirements

The Run button uses the `noob` command. Install it once with:

```sh
npm install -g noobscript-lang
```

## Example

```noob
queue greet(name) {
    gg "gg wp, " + name;
}

farm (vibe i = 0; i < 3; i = i + 1) {
    chat(greet("player" + i));
}
```

## Settings

| Setting | Default | Description |
|---|---|---|
| `noobscript.command` | `noob` | Command used to run `.noob` files |
