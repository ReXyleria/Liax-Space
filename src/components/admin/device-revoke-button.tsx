"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

export function DeviceRevokeButton({
  id,
  label,
  title,
  description,
  action
}: {
  id: string;
  label: string;
  title: string;
  description: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmActionDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={label}
        cancelLabel="取消"
        onOpenChange={setOpen}
        action={action}
        hiddenFields={[{ name: "id", value: id }]}
      />
    </>
  );
}
