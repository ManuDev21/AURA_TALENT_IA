import { useState } from 'react'
import { type DefaultValues, type FieldValues, type Path, useForm } from 'react-hook-form'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { useProfileItems } from '@/features/talent/useProfileData'
import type { ItemKind, ItemPayload } from '@/types/talent'

interface Options<K extends ItemKind, V extends FieldValues> {
  kind: K
  itemId?: string
  defaults: DefaultValues<V>
  toPayload: (values: V) => ItemPayload<K>
  onDone: () => void
}

/** Formulario de una entidad del perfil con errores del servidor mapeados a los campos. */
export function useItemForm<K extends ItemKind, V extends FieldValues>(options: Options<K, V>) {
  const { save } = useProfileItems(options.kind)
  const [formError, setFormError] = useState('')
  const form = useForm<V>({ defaultValues: options.defaults })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError('')
    try {
      await save.mutateAsync({ id: options.itemId, data: options.toPayload(values) })
      options.onDone()
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, Object.keys(values) as Path<V>[]))
    }
  })

  return { form, onSubmit, formError, saving: save.isPending }
}
