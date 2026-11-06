// Inviter quelqu'un dans une famille : un lien qui contient le code (le code seul reste là pour le dicter).
import { inviteLink } from './invite.js';

const invitation = (family) => `Rejoins « ${family.name} » sur La Hotte : ${inviteLink(family.code)}`;

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

// Renvoie 'shared', 'copied' (pas de partage natif : l'invitation est copiée) ou 'cancelled'.
export async function shareFamily(family) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'La Hotte', text: invitation(family) });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  await copyText(invitation(family));
  return 'copied';
}
