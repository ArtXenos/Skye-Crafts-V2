"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createProduct, deleteProduct, removeProductImage, saveProduct, uploadProductImage } from "@/app/actions/admin";
import { PhotoPicker } from "@/components/admin/photo-picker";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Notice, Select, Textarea } from "@/components/ui/form";
import { formResolver } from "@/components/form-resolver";
import { useActionForm } from "@/components/use-action-form";
import { failure } from "@/lib/action-result";
import { CATEGORIES } from "@/lib/shop";
import { productSchema, type ProductInput } from "@/lib/validation";

export function ProductForm({ productId, initial, loadedAt }: { productId: number | null; initial: ProductInput; loadedAt?: string }) {
  const form = useForm<ProductInput>({ resolver: formResolver(productSchema), defaultValues: initial });
  const isNew = !productId;
  // A new product is added together with its photo.
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");

  async function save(values: ProductInput) {
    if (!productId) {
      if (!photo) {
        setPhotoError("Add a photo of the piece.");
        return failure("Add a photo of the piece.");
      }
      const data = new FormData();
      data.set("image", photo);
      const result = await createProduct(values, data);
      if (result && !result.ok) setPhotoError(result.fieldErrors?.image?.[0] ?? "");
      return result;
    }
    // Stock changes by itself as orders come in, so it is only saved when the
    // owner actually edited it (and then only if nothing changed meanwhile).
    return saveProduct(productId, values, { stockChanged: Boolean(form.formState.dirtyFields.stock), loadedAt });
  }
  const { submit, pending, message } = useActionForm(form, save, { successToast: true });
  const errors = form.formState.errors;
  const preorder = useWatch({ control: form.control, name: "is_preorder" });

  // Next.js keeps recently visited pages alive but hidden. When the "add a
  // product" page is left, clear it so the next visit starts empty.
  const resetRef = useRef(() => {
    form.reset(initial);
    setPhoto(null);
    setPhotoError("");
  });
  useLayoutEffect(() => () => {
    if (isNew) resetRef.current();
  }, [isNew]);

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field label="Name" hint="The name of this variety, as customers will see it." error={errors.title?.message}>
        {(p) => <Input {...p} {...form.register("title")} />}
      </Field>
      <Field label="Description" hint="What makes this variety different: colours, flowers, size, wrapping." error={errors.description?.message}>
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
      {isNew && (
        <PhotoPicker label="Photo" value={photo} error={photoError}
          onChange={(file) => { setPhoto(file); setPhotoError(""); }} />
      )}
      {message?.tone === "error" && message.text !== photoError && <Notice tone="error">{message.text}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : productId ? "Save changes" : "Add product"}</Button>
      </div>
    </form>
  );
}

/** Change or remove the photo of a product that already exists. */
export function ProductPhotoEditor({ productId, currentUrl }: { productId: number; currentUrl: string | null }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function upload() {
    if (!photo) return;
    startTransition(async () => {
      const data = new FormData();
      data.set("productId", String(productId));
      data.set("image", photo);
      const result = await uploadProductImage(null, data);
      if (result.ok) {
        toast.success(result.message ?? "Photo updated.");
        setPhoto(null);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <PhotoPicker label={currentUrl ? "Photo" : "Add a photo"} value={photo} currentUrl={currentUrl} error={error}
        onChange={(file) => { setPhoto(file); setError(""); }} />
      <div className="flex flex-wrap gap-2">
        {photo && <Button type="button" disabled={pending} onClick={upload}>{pending ? "Saving photo…" : "Save this photo"}</Button>}
        {currentUrl && !photo && (
          <Button type="button" variant="ghost" size="sm" disabled={pending}
            onClick={() => startTransition(async () => {
              const removed = await removeProductImage(productId);
              if (removed.ok) toast.success(removed.message ?? "Photo removed.");
              else toast.error(removed.message);
            })}>
            Remove photo
          </Button>
        )}
      </div>
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
