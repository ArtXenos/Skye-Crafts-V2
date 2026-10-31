"use client";

import { useForm, useWatch } from "react-hook-form";
import { submitReview } from "@/app/actions/shop";
import { Button } from "@/components/ui/button";
import { Field, Notice, Textarea } from "@/components/ui/form";
import { formResolver } from "@/components/form-resolver";
import { useActionForm } from "@/components/use-action-form";
import { reviewSchema, type ReviewInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function ReviewForm({ productId }: { productId: number }) {
  const form = useForm<ReviewInput>({
    resolver: formResolver(reviewSchema),
    defaultValues: { productId, rating: 0, body: "" },
  });
  const { submit, pending, message } = useActionForm(form, submitReview);
  const rating = useWatch({ control: form.control, name: "rating" });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-[var(--radius-tile)] bg-white p-6 ring-2 ring-line">
      <h3 className="text-xl">Review your piece</h3>
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-semibold">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" value={value} className="peer sr-only" checked={rating === value}
                onChange={() => form.setValue("rating", value, { shouldValidate: true })} />
              <span className={cn("block rounded-md px-0.5 text-3xl leading-none peer-focus-visible:outline-3 peer-focus-visible:outline-bloom-deep",
                value <= rating ? "text-wire" : "text-line")}>★</span>
              <span className="sr-only">{value} star{value === 1 ? "" : "s"}</span>
            </label>
          ))}
        </div>
        {errors.rating && <p className="text-sm font-medium text-alert">{errors.rating.message}</p>}
      </fieldset>
      <Field label="What did you think?" optional error={errors.body?.message}>
        {(p) => <Textarea rows={3} {...p} {...form.register("body")} />}
      </Field>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Posting…" : "Post review"}</Button>
      </div>
    </form>
  );
}
