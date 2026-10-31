"use client";

import { useActionState, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { deleteProduct, removeProductImage, saveProduct, uploadProductImage } from "@/app/actions/admin";
import { guardPhotoSize } from "@/components/file-size-guard";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Notice, Select, Textarea } from "@/components/ui/form";
import { formResolver } from "@/components/form-resolver";
import { useActionForm } from "@/components/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { CATEGORIES } from "@/lib/shop";
import { productSchema, type ProductInput } from "@/lib/validation";

export function ProductForm({ productId, initial, loadedAt }: { productId: number | null; initial: ProductInput; loadedAt?: string }) {
  const form = useForm<ProductInput>({ resolver: formResolver(productSchema), defaultValues: initial });
  // Stock changes by itself as orders come in, so it is only saved when the
  // owner actually edited it (and then only if nothing changed meanwhile).
  const { submit, pending, message } = useActionForm(
    form,
    (values: ProductInput) => saveProduct(productId, values, { stockChanged: Boolean(form.formState.dirtyFields.stock), loadedAt }),
    { successToast: true },
  );
  const errors = form.formState.errors;
  const preorder = useWatch({ control: form.control, name: "is_preorder" });

  // Next.js keeps recently visited pages alive but hidden. When the "add a
  // product" page is left, clear it so the next visit starts empty.
  const isNew = !productId;
  const resetRef = useRef(() => form.reset(initial));
  useLayoutEffect(() => () => {
    if (isNew) resetRef.current();
  }, [isNew]);

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field label="Name" error={errors.title?.message}>
        {(p) => <Input {...p} {...form.register("title")} />}
      </Field>
      <Field label="Description" error={errors.description?.message}>
        {(p) => <Textarea rows={4} {...p} {...form.register("description")} />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Category" error={errors.category?.message}>
          {(p) => (
            <Select {...p} {...form.register("category")}>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Price (₱)" error={errors.price?.message}>
          {(p) => <Input inputMode="decimal" placeholder="450" {...p} {...form.register("price")} />}
        </Field>
        <Field label="In stock" hint={preorder ? "Ignored for made-to-order pieces." : undefined} error={errors.stock?.message}>
          {(p) => <Input type="number" min={0} step={1} disabled={preorder} {...p} {...form.register("stock")} />}
        </Field>
      </div>
      <div className="grid gap-2">
        <Checkbox label="Made to order (pre-order): no stock limit" {...form.register("is_preorder")} />
        <Checkbox label="Show in the shop" {...form.register("is_active")} />
      </div>
      {message?.tone === "error" && <Notice tone="error">{message.text}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : productId ? "Save changes" : "Add product"}</Button>
      </div>
    </form>
  );
}

export function ProductImageForm({ productId, hasImage }: { productId: number; hasImage: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(uploadProductImage, null);
  const [removing, startRemove] = useTransition();
  const inputId = useId();
  const [tooBig, setTooBig] = useState("");
  return (
    <div className="grid gap-3">
      <form action={action} onSubmit={(event) => guardPhotoSize(event, setTooBig)} className="grid gap-3">
        <input type="hidden" name="productId" value={productId} />
        <label htmlFor={inputId} className="font-semibold">{hasImage ? "Replace the photo" : "Add a photo"}</label>
        <input id={inputId} name="image" type="file" accept="image/jpeg,image/png,image/webp" required
          className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:font-semibold file:text-paper" />
        <p className="text-sm text-ink-soft">Square photos look best. JPG, PNG or WebP, up to 4 MB.</p>
        {tooBig ? <Notice tone="error">{tooBig}</Notice> : result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Uploading…" : "Upload photo"}</Button>
          {hasImage && (
            <Button variant="ghost" disabled={removing}
              onClick={() => startRemove(async () => {
                const removed = await removeProductImage(productId);
                if (removed.ok) toast.success(removed.message ?? "Photo removed.");
                else toast.error(removed.message);
              })}>
              Remove photo
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export function DeleteProductButton({ productId, title }: { productId: number; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) return <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>Delete product</Button>;
  return (
    <div className="grid gap-3 rounded-xl bg-alert-soft p-4">
      <p className="text-alert">
        Delete <strong>{title}</strong> and its reviews? Past orders keep their copy of the name and price.
        To stop selling it but keep it, untick &ldquo;Show in the shop&rdquo; instead.
      </p>
      <div className="flex gap-2">
        <Button variant="danger" size="sm" disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await deleteProduct(productId);
            if (result && !result.ok) toast.error(result.message);
          })}>
          {pending ? "Deleting…" : "Yes, delete it"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep it</Button>
      </div>
    </div>
  );
}
