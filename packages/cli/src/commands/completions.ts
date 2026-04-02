import { Command } from 'commander';

export function registerCompletionsCommand(program: Command): void {
  program
    .command('completions <shell>')
    .description('產生 shell 自動補全腳本 (bash/zsh/fish)')
    .action((shell: string) => {
      const commands = [
        'login', 'logout', 'whoami', 'status', 'courses', 'open',
        'assignments', 'submission', 'download', 'upload', 'grades',
        'calendar', 'news', 'updates', 'notifications', 'sync',
        'export', 'config', 'obsidian', 'diff', 'completions',
      ];

      if (shell === 'bash') {
        console.log(`# Add to ~/.bashrc:
# eval "$(e3 completions bash)"

_e3_completions() {
  local cur=\${COMP_WORDS[COMP_CWORD]}
  COMPREPLY=( $(compgen -W "${commands.join(' ')}" -- "$cur") )
}
complete -F _e3_completions e3`);
      } else if (shell === 'zsh') {
        console.log(`# Add to ~/.zshrc:
# eval "$(e3 completions zsh)"

_e3() {
  local commands=(${commands.join(' ')})
  _describe 'e3 commands' commands
}
compdef _e3 e3`);
      } else if (shell === 'fish') {
        console.log(`# Add to ~/.config/fish/completions/e3.fish:
${commands.map(c => `complete -c e3 -n '__fish_use_subcommand' -a '${c}'`).join('\n')}`);
      } else {
        console.error(`Unsupported shell: ${shell}. Use bash, zsh, or fish.`);
        process.exit(1);
      }
    });
}
