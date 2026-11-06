import { useState } from 'react';
import Icon from './Icon.jsx';
import WishForm from './WishForm.jsx';

export default function AddWishForm({ ownerId, forSomeoneElse, onAdded }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="add-button" onClick={() => setOpen(true)}>
        <Icon name="plus" size={20} />
        {forSomeoneElse ? 'Ajouter une idée' : 'Ajouter une envie'}
      </button>
    );
  }

  return (
    <WishForm
      ownerId={ownerId}
      forSomeoneElse={forSomeoneElse}
      onDone={() => {
        setOpen(false);
        onAdded();
      }}
      onCancel={() => setOpen(false)}
    />
  );
}
