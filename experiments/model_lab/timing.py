"""Host wall-clock instrumentation; CUDA transfers are explicit only in bound mode."""
import time


def measured(values, name, operation, *args, **kwargs):
    started = time.perf_counter()
    try:
        return operation(*args, **kwargs)
    finally:
        values[name] = values.get(name, 0) + (time.perf_counter() - started) * 1000


def instrument(model, prefix, values, io_mode='standard'):
    """Wrap rtmlib's public stages. Repeated person crops accumulate per frame."""
    import numpy as np
    for name in ('preprocess', 'postprocess'):
        original = getattr(model, name)
        def wrapped(*args, _name=name, _original=original, **kwargs):
            return measured(values, f'{prefix}.{_name}_ms', _original, *args, **kwargs)
        setattr(model, name, wrapped)

    def inference(image):
        values[f'{prefix}.calls'] = values.get(f'{prefix}.calls', 0) + 1
        batch = measured(values, f'{prefix}.pack_ms',
                         lambda: np.ascontiguousarray(image.transpose(2, 0, 1), dtype=np.float32)[None])
        session = model.session
        names = [out.name for out in session.get_outputs()]
        input_name = session.get_inputs()[0].name
        if io_mode == 'standard':
            # session.run includes implicit transfers on CUDA: do not call this pure GPU time.
            return measured(values, f'{prefix}.run_including_transfer_ms',
                            session.run, names, {input_name: batch})
        import onnxruntime as ort
        binding = session.io_binding()
        def upload():
            device_input = ort.OrtValue.ortvalue_from_numpy(batch, 'cuda', 0)
            binding.bind_ortvalue_input(input_name, device_input)
            binding.synchronize_inputs()
            return device_input
        # Keep device input alive until all output copies complete.
        device_input = measured(values, f'{prefix}.h2d_allocate_bind_sync_ms', upload)
        for name in names:
            binding.bind_output(name, 'cuda', 0)
        def compute():
            session.run_with_iobinding(binding)
            binding.synchronize_outputs()
        measured(values, f'{prefix}.bound_run_sync_ms', compute)
        outputs = measured(values, f'{prefix}.d2h_copy_ms', binding.copy_outputs_to_cpu)
        del device_input
        return outputs
    model.inference = inference


TIMING_SCOPE = {
    'clock': 'perf_counter host wall ms; nested totals must not be added to child stages',
    'standard': 'session.run includes implicit H2D/D2H on CUDA; no separate transfer estimate',
    'bound': 'diagnostic CUDA IOBinding; explicit input allocation/copy/bind/sync and output copy; run includes host overhead, CPU nodes and output allocation, not pure GPU kernel time',
    'heavy': 'MediaPipe public detect bundles internal detection and landmarks; not separable here',
}
