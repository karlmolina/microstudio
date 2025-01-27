var Compiler, LocalLayer;

Compiler = (function() {
  function Compiler(program) {
    var context, i, j, len, ref, s;
    this.program = program;
    this.code_saves = [];
    this.code = "";
    this.code = [this.code];
    context = {
      local_variables: {},
      temp_variable_count: 0,
      tmpcount: 0
    };
    this.routine = new Routine();
    this.locals = new Locals();
    this.count = 0;
    ref = this.program.statements;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      s = ref[i];
      this.compile(s, context);
      if (i < this.program.statements.length - 1) {
        this.routine.POP(s);
      }
    }
    this.routine.optimize();
    this.routine.resolveLabels();
    this.count += this.routine.opcodes.length;
    this.routine.locals_size = this.locals.index;
    console.info(this.routine.toString());
    console.info("total length: " + this.count);
  }

  Compiler.prototype.compile = function(statement, context, retain) {
    if (statement instanceof Program.Value) {
      return this.compileValue(statement, context);
    } else if (statement instanceof Program.Operation) {
      return this.compileOperation(statement, context);
    } else if (statement instanceof Program.Assignment) {
      return this.compileAssignment(statement, context, retain);
    } else if (statement instanceof Program.Variable) {
      return this.compileVariable(statement, context);
    } else if (statement instanceof Program.Function) {
      return this.compileFunction(statement, context);
    } else if (statement instanceof Program.FunctionCall) {
      return this.compileFunctionCall(statement, context, retain);
    } else if (statement instanceof Program.While) {
      return this.compileWhile(statement, context, retain);
    }
    if (statement instanceof Program.SelfAssignment) {
      return this.compileSelfAssignment(statement, context, retain);
    } else if (statement instanceof Program.Braced) {
      return this.compileBraced(statement, context, retain);
    } else if (statement instanceof Program.CreateObject) {
      return this.compileCreateObject(statement, context);
    } else if (statement instanceof Program.Field) {
      return this.compileField(statement, context);
    } else if (statement instanceof Program.Negate) {
      return this.compileNegate(statement, context, retain);
    } else if (statement instanceof Program.For) {
      return this.compileFor(statement, context, retain);
    } else if (statement instanceof Program.ForIn) {
      return this.compileForIn(statement, context, retain);
    } else if (statement instanceof Program.Not) {
      return this.compileNot(statement, context, retain);
    } else if (statement instanceof Program.Return) {
      return this.compileReturn(statement, context);
    } else if (statement instanceof Program.Condition) {
      return this.compileCondition(statement, context, retain);
    } else if (statement instanceof Program.Break) {
      return this.compileBreak(statement, context);
    } else if (statement instanceof Program.Continue) {
      return this.compileContinue(statement, context);
    } else if (statement instanceof Program.CreateClass) {
      return this.compileCreateClass(statement, context);
    } else if (statement instanceof Program.NewCall) {
      return this.compileNewCall(statement, context);
    } else if (true) {
      console.info(statement);
      throw "Not implemented";
    }
  };

  Compiler.prototype.compileAssignment = function(statement, context, retain) {
    var f, i, index, j, ref;
    if (statement.local) {
      if (statement.field instanceof Program.Variable) {
        index = this.locals.register(statement.field.identifier);
        this.compile(statement.expression, context, true);
        return this.routine.STORE_LOCAL(index, statement);
      } else {
        throw "illegal";
      }
    } else {
      if (statement.field instanceof Program.Variable) {
        if (this.locals.get(statement.field.identifier) != null) {
          this.compile(statement.expression, context, true);
          index = this.locals.get(statement.field.identifier);
          this.routine.STORE_LOCAL(index, statement);
        } else if (statement.expression instanceof Program.CreateClass) {
          return this.compileUpdateClass(statement.expression, statement.field.identifier);
        } else {
          this.compile(statement.expression, context, true);
          this.routine.STORE_VARIABLE(statement.field.identifier, statement);
        }
      } else {
        f = statement.field;
        if (f.expression instanceof Program.Variable) {
          if (f.expression.identifier === "this") {
            this.routine.LOAD_THIS(f);
          } else if (this.locals.get(f.expression.identifier) != null) {
            index = this.locals.get(f.expression.identifier);
            this.routine.LOAD_LOCAL_OBJECT(index, f.expression);
          } else if (f.expression.identifier === "global") {
            this.routine.LOAD_GLOBAL(f);
          } else {
            this.routine.LOAD_VARIABLE_OBJECT(f.expression.identifier, statement);
          }
        } else {
          this.compile(f.expression, context, true);
          this.routine.MAKE_OBJECT(statement);
        }
        for (i = j = 0, ref = f.chain.length - 2; j <= ref; i = j += 1) {
          this.compile(f.chain[i], context, true);
          this.routine.LOAD_PROPERTY_OBJECT(f.chain[i]);
        }
        this.compile(f.chain[f.chain.length - 1], context, true);
        this.compile(statement.expression, context, true);
        return this.routine.STORE_PROPERTY(statement);
      }
    }
  };

  Compiler.prototype.compileSelfAssignment = function(statement, context, retain) {
    var c, f, i, index, j, op, ref;
    switch (statement.operation) {
      case Token.TYPE_PLUS_EQUALS:
        op = "+";
        break;
      case Token.TYPE_MINUS_EQUALS:
        op = "-";
        break;
      case Token.TYPE_MULTIPLY_EQUALS:
        op = "*";
        break;
      case Token.TYPE_DIVIDE_EQUALS:
        op = "/";
    }
    if (statement.field instanceof Program.Variable) {
      if (this.locals.get(statement.field.identifier) != null) {
        this.compile(statement.expression, context, true);
        index = this.locals.get(statement.field.identifier);
        switch (op) {
          case "+":
            this.routine.ADD_LOCAL(index, statement);
            break;
          case "-":
            this.routine.SUB_LOCAL(index, statement);
        }
      } else {
        this.compile(statement.expression, context, true);
        switch (op) {
          case "+":
            this.routine.ADD_VARIABLE(statement.field.identifier, statement);
            break;
          case "-":
            this.routine.SUB_VARIABLE(statement.field.identifier, statement);
        }
      }
    } else {
      f = statement.field;
      if (f.expression instanceof Program.Variable) {
        if (f.expression.identifier === "this") {
          this.routine.LOAD_THIS(f);
        } else if (this.locals.get(f.expression.identifier) != null) {
          index = this.locals.get(f.expression.identifier);
          this.routine.LOAD_LOCAL_OBJECT(index, statement);
        } else if (f.expression.identifier === "global") {
          this.routine.LOAD_GLOBAL(f);
        } else {
          this.routine.LOAD_VARIABLE_OBJECT(f.expression.identifier, statement);
        }
      } else {
        this.compile(f.expression, context, true);
        this.routine.MAKE_OBJECT(statement);
      }
      for (i = j = 0, ref = f.chain.length - 2; j <= ref; i = j += 1) {
        this.compile(f.chain[i], context, true);
        this.routine.LOAD_PROPERTY_OBJECT(f.chain[i]);
      }
      c = f.chain[f.chain.length - 1];
      this.compile(f.chain[f.chain.length - 1], context, true);
      this.compile(statement.expression, context, true);
      switch (op) {
        case "+":
          return this.routine.ADD_PROPERTY(statement);
        case "-":
          return this.routine.SUB_PROPERTY(statement);
      }
    }
  };

  Compiler.prototype.compileOperation = function(op, context) {
    var ref, ref1;
    if ((ref = op.operation) === "+" || ref === "-" || ref === "*" || ref === "/" || ref === "%") {
      this.compile(op.term1, context, true);
      this.compile(op.term2, context, true);
      switch (op.operation) {
        case "+":
          this.routine.ADD(op);
          break;
        case "-":
          this.routine.SUB(op);
          break;
        case "*":
          this.routine.MUL(op);
          break;
        case "/":
          this.routine.DIV(op);
          break;
        case "%":
          this.routine.MODULO(op);
      }
    } else if ((ref1 = op.operation) === "==" || ref1 === "!=" || ref1 === "<" || ref1 === ">" || ref1 === "<=" || ref1 === ">=") {
      this.compile(op.term1, context, true);
      this.compile(op.term2, context, true);
      switch (op.operation) {
        case "==":
          this.routine.EQ(op);
          break;
        case "!=":
          this.routine.NEQ(op);
          break;
        case "<":
          this.routine.LT(op);
          break;
        case ">":
          this.routine.GT(op);
          break;
        case "<=":
          this.routine.LTE(op);
          break;
        case ">=":
          this.routine.GTE(op);
      }
    } else if (op.operation === "and") {
      return "((" + (this.transpile(op.term1, context, true)) + " && " + (this.transpile(op.term2, context, true)) + ")? 1 : 0)";
    } else if (op.operation === "or") {
      return "((" + (this.transpile(op.term1, context, true)) + " || " + (this.transpile(op.term2, context, true)) + ")? 1 : 0)";
    } else if (op.operation === "^") {
      return "Math.pow(" + (this.transpile(op.term1, context, true)) + "," + (this.transpile(op.term2, context, true)) + ")";
    } else {
      return "";
    }
  };

  Compiler.prototype.compileBraced = function(expression, context, retain) {
    this.compile(expression.expression, context, retain);
  };

  Compiler.prototype.compileNegate = function(expression, context, retain) {
    if (expression.expression instanceof Program.Value && expression.expression.type === Program.Value.TYPE_NUMBER) {
      return this.routine.LOAD_VALUE(-expression.expression.value, expression);
    } else {
      this.compile(expression.expression, context, true);
      return this.routine.NEGATE(expression);
    }
  };

  Compiler.prototype.compileNot = function(expression, context, retain) {
    this.compile(expression.expression, context, true);
    return this.routine.NOT(expression);
  };

  Compiler.prototype.compileValue = function(value, context) {
    var i, j, ref;
    switch (value.type) {
      case Program.Value.TYPE_NUMBER:
        this.routine.LOAD_VALUE(value.value, value);
        break;
      case Program.Value.TYPE_STRING:
        this.routine.LOAD_VALUE(value.value, value);
        break;
      case Program.Value.TYPE_ARRAY:
        this.routine.CREATE_ARRAY(value);
        for (i = j = 0, ref = value.value.length - 1; j <= ref; i = j += 1) {
          this.routine.LOAD_VALUE(i, value);
          this.compile(value.value[i], context, true);
          this.routine.CREATE_PROPERTY(value);
        }
    }
  };

  Compiler.prototype.compileVariable = function(variable) {
    var index, v;
    v = variable.identifier;
    if (v === "this") {
      return this.routine.LOAD_THIS(variable);
    } else if (Compiler.predefined_values[v] != null) {
      return this.routine.LOAD_VALUE(Compiler.predefined_values[v], variable);
    } else if (this.locals.get(v) != null) {
      index = this.locals.get(v);
      return this.routine.LOAD_LOCAL(index, variable);
    } else {
      return this.routine.LOAD_VARIABLE(v, variable);
    }
  };

  Compiler.prototype.compileField = function(field) {
    var c, j, len, ref;
    this.compile(field.expression);
    ref = field.chain;
    for (j = 0, len = ref.length; j < len; j++) {
      c = ref[j];
      this.compile(c);
      this.routine.LOAD_PROPERTY(field);
    }
  };

  Compiler.prototype.compileFieldParent = function(field, context) {
    var c, i, j, ref;
    this.compile(field.expression);
    for (i = j = 0, ref = field.chain.length - 2; j <= ref; i = j += 1) {
      c = field.chain[i];
      this.compile(c);
      this.routine.LOAD_PROPERTY(field);
    }
  };

  Compiler.prototype.compileFunctionCall = function(call) {
    var a, funk, i, index, j, k, l, len, len1, len2, len3, len4, m, n, ref, ref1, ref2, ref3, ref4;
    if (call.expression instanceof Program.Field) {
      ref = call.args;
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        a = ref[i];
        this.compile(a);
      }
      this.compileFieldParent(call.expression);
      this.compile(call.expression.chain[call.expression.chain.length - 1]);
      return this.routine.FUNCTION_APPLY_PROPERTY(call.args.length, call);
    } else if (call.expression instanceof Program.Variable) {
      if (Compiler.predefined_unary_functions[call.expression.identifier] != null) {
        funk = Compiler.predefined_unary_functions[call.expression.identifier];
        if (call.args.length > 0) {
          this.compile(call.args[0]);
        } else {
          this.routine.LOAD_VALUE(0, call);
        }
        return this.routine[funk](call);
      } else if (Compiler.predefined_binary_functions[call.expression.identifier] != null) {
        funk = Compiler.predefined_binary_functions[call.expression.identifier];
        if (call.args.length > 0) {
          this.compile(call.args[0]);
        } else {
          this.routine.LOAD_VALUE(0, call);
        }
        if (call.args.length > 1) {
          this.compile(call.args[1]);
        } else {
          this.routine.LOAD_VALUE(0, call);
        }
        return this.routine[funk](call);
      } else if (call.expression.identifier === "super") {
        ref1 = call.args;
        for (i = k = 0, len1 = ref1.length; k < len1; i = ++k) {
          a = ref1[i];
          this.compile(a);
        }
        return this.routine.SUPER_CALL(call.args.length, call);
      } else if (this.locals.get(call.expression.identifier) != null) {
        ref2 = call.args;
        for (i = l = 0, len2 = ref2.length; l < len2; i = ++l) {
          a = ref2[i];
          this.compile(a);
        }
        index = this.locals.get(call.expression.identifier);
        this.routine.LOAD_LOCAL(index, call);
        return this.routine.FUNCTION_CALL(call.args.length, call);
      } else {
        ref3 = call.args;
        for (i = m = 0, len3 = ref3.length; m < len3; i = ++m) {
          a = ref3[i];
          this.compile(a);
        }
        this.routine.LOAD_VALUE(call.expression.identifier, call);
        return this.routine.FUNCTION_APPLY_VARIABLE(call.args.length, call);
      }
    } else {
      ref4 = call.args;
      for (n = 0, len4 = ref4.length; n < len4; n++) {
        a = ref4[n];
        this.compile(a);
      }
      this.compile(call.expression);
      return this.routine.FUNCTION_CALL(call.args.length, call);
    }
  };

  Compiler.prototype.compileFor = function(forloop, context, retain) {
    var for_continue, for_end, for_start, iterator, save_break, save_continue;
    iterator = this.locals.register(forloop.iterator);
    this.locals.allocate();
    this.locals.allocate();
    this.compile(forloop.range_from, context, true);
    this.routine.STORE_LOCAL(iterator, forloop);
    this.routine.POP(forloop);
    this.compile(forloop.range_to, context, true);
    if (forloop.range_by !== 0) {
      this.compile(forloop.range_by, context, true);
    } else {
      this.routine.LOAD_VALUE(0, forloop);
    }
    for_start = this.routine.createLabel("for_start");
    for_continue = this.routine.createLabel("for_continue");
    for_end = this.routine.createLabel("for_end");
    this.routine.FORLOOP_INIT([iterator, for_end], forloop);
    this.routine.setLabel(for_start);
    this.locals.push();
    save_break = this.break_label;
    save_continue = this.continue_label;
    this.break_label = for_end;
    this.continue_label = for_continue;
    this.compileSequence(forloop.sequence, context);
    this.break_label = save_break;
    this.continue_label = save_continue;
    this.routine.setLabel(for_continue);
    this.routine.FORLOOP_CONTROL([iterator, for_start], forloop);
    this.routine.setLabel(for_end);
    return this.locals.pop();
  };

  Compiler.prototype.compileForIn = function(forloop, context, retain) {
    var for_continue, for_end, for_start, iterator, save_break, save_continue;
    iterator = this.locals.register(forloop.iterator);
    this.locals.allocate();
    this.locals.allocate();
    this.compile(forloop.list, context, true);
    for_start = this.routine.createLabel("for_start");
    for_continue = this.routine.createLabel("for_continue");
    for_end = this.routine.createLabel("for_end");
    this.routine.FORIN_INIT([iterator, for_end], forloop);
    this.routine.setLabel(for_start);
    this.locals.push();
    save_break = this.break_label;
    save_continue = this.continue_label;
    this.break_label = for_end;
    this.continue_label = for_continue;
    this.compileSequence(forloop.sequence, context);
    this.break_label = save_break;
    this.continue_label = save_continue;
    this.routine.setLabel(for_continue);
    this.routine.FORIN_CONTROL([iterator, for_start], forloop);
    this.routine.setLabel(for_end);
    return this.locals.pop();
  };

  Compiler.prototype.compileSequence = function(sequence, context) {
    var i, j, ref;
    for (i = j = 0, ref = sequence.length - 1; j <= ref; i = j += 1) {
      if (!sequence[i].nopop) {
        this.routine.POP(sequence[i]);
      }
      this.compile(sequence[i], context, true);
    }
  };

  Compiler.prototype.compileWhile = function(whiloop, context, retain) {
    var end, save_break, save_continue, start;
    this.locals.push();
    start = this.routine.createLabel("while_start");
    end = this.routine.createLabel("while_end");
    this.routine.LOAD_VALUE(0, whiloop);
    this.routine.setLabel(start);
    this.compile(whiloop.condition, context, true);
    this.routine.JUMPN(end);
    save_break = this.break_label;
    save_continue = this.continue_label;
    this.break_label = end;
    this.continue_label = start;
    this.compileSequence(whiloop.sequence, context);
    this.routine.JUMP(start, whiloop);
    this.break_label = save_break;
    this.continue_label = save_continue;
    this.routine.setLabel(end);
    return this.locals.pop();
  };

  Compiler.prototype.compileBreak = function(statement, context) {
    if (this.break_label != null) {
      return this.routine.JUMP(this.break_label);
    }
  };

  Compiler.prototype.compileContinue = function(statement, context) {
    if (this.continue_label != null) {
      return this.routine.JUMP(this.continue_label);
    }
  };

  Compiler.prototype.compileFunction = function(func, context) {
    var a, i, index, j, k, local_index, locals, r, ref, ref1, routine;
    routine = this.routine;
    locals = this.locals;
    this.routine = new Routine(func.args.length);
    this.locals = new Locals();
    local_index = this.locals.index;
    for (i = j = ref = func.args.length - 1; j >= 0; i = j += -1) {
      a = func.args[i];
      index = this.locals.register(a.name);
      this.routine.STORE_LOCAL(index, func);
      this.routine.POP(func);
    }
    for (i = k = 0, ref1 = func.sequence.length - 1; k <= ref1; i = k += 1) {
      this.compile(func.sequence[i], context, true);
      if (i < func.sequence.length - 1) {
        this.routine.POP(func.sequence[i]);
      } else {
        this.routine.RETURN(func.sequence[i]);
      }
    }
    this.routine.optimize();
    this.routine.resolveLabels();
    this.count += this.routine.opcodes.length;
    r = this.routine;
    this.routine.locals_size = locals.index;
    this.routine = routine;
    this.locals = locals;
    return this.routine.LOAD_VALUE(r, func);
  };

  Compiler.prototype.compileReturn = function(ret, context) {
    if (ret.expression != null) {
      this.compile(ret.expression, context, true);
      return this.routine.RETURN(ret);
    } else {
      this.routine.LOAD_VALUE(0, ret);
      return this.routine.RETURN(ret);
    }
  };

  Compiler.prototype.compileCondition = function(condition, context, retain) {
    var c, chain, condition_end, condition_next, i, j, ref;
    chain = condition.chain;
    this.routine.LOAD_VALUE(0, condition);
    condition_end = this.routine.createLabel("condition_end");
    for (i = j = 0, ref = chain.length - 1; j <= ref; i = j += 1) {
      condition_next = this.routine.createLabel("condition_next");
      c = chain[i];
      this.compile(c.condition, context, true);
      this.routine.JUMPN(condition_next);
      this.compileSequence(c.sequence, context, true);
      this.routine.JUMP(condition_end, condition);
      this.routine.setLabel(condition_next);
      if (i === chain.length - 1 && (c["else"] != null)) {
        this.compileSequence(c["else"], context, true);
      }
    }
    this.routine.setLabel(condition_end);
  };

  Compiler.prototype.formatField = function(field) {
    if (field === "constructor") {
      field = "_constructor";
    }
    return field.toString().replace(/"/g, "\\\"");
  };

  Compiler.prototype.compileCreateObject = function(statement, context) {
    var f, j, len, ref;
    this.routine.CREATE_OBJECT(statement);
    ref = statement.fields;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      this.routine.LOAD_VALUE(f.field, statement);
      this.compile(f.value, context, true);
      this.routine.CREATE_PROPERTY(statement);
    }
  };

  Compiler.prototype.compileCreateClass = function(statement, context) {
    var f, j, len, ref, variable;
    if (statement.ext != null) {
      this.compile(statement.ext, context, true);
    } else {
      this.routine.LOAD_VALUE(0, statement);
    }
    variable = (statement.ext != null) && statement.ext instanceof Program.Variable ? statement.ext.identifier : 0;
    this.routine.CREATE_CLASS(variable, statement);
    ref = statement.fields;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      this.routine.LOAD_VALUE(f.field, statement);
      this.compile(f.value, context, true);
      this.routine.CREATE_PROPERTY(statement);
    }
  };

  Compiler.prototype.compileUpdateClass = function(statement, variable) {
    this.compileCreateClass(statement);
    return this.routine.UPDATE_CLASS(variable, statement);
  };

  Compiler.prototype.compileNewCall = function(statement) {
    var a, call, i, j, len, ref;
    call = statement.expression;
    this.routine.LOAD_VALUE(0, statement);
    ref = call.args;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      a = ref[i];
      this.compile(a);
    }
    this.compile(call.expression);
    this.routine.NEW_CALL(call.args.length, statement);
    return this.routine.POP(statement);
  };

  Compiler.prototype.exec = function(context) {
    this.processor = new Processor();
    this.processor.load(this.routine);
    return this.processor.run(context);
  };

  Compiler.predefined_unary_functions = {
    "round": "ROUND",
    "floor": "FLOOR",
    "ceil": "CEIL",
    "abs": "ABS",
    "sqrt": Math.sqrt,
    "sin": "SIN",
    "cos": "COS",
    "tan": "TAN",
    "acos": "ACOS",
    "asin": "ASIN",
    "atan": "ATAN",
    "sind": "SIND",
    "cosd": "COSD",
    "tand": "TAND",
    "asind": "ASIND",
    "acosd": "ACOSD",
    "atand": "ATAND",
    "log": "LOG",
    "exp": "EXP"
  };

  Compiler.predefined_binary_functions = {
    "min": "MIN",
    "max": "MAX",
    "pow": "POW",
    "atan2": "ATAND",
    "atan2d": "ATAN2D"
  };

  Compiler.predefined_values = {
    PI: Math.PI,
    "true": 1,
    "false": 0
  };

  return Compiler;

})();

this.Locals = (function() {
  function Locals() {
    this.layers = [];
    this.index = 0;
    this.push();
  }

  Locals.prototype.push = function() {
    return this.layers.push(new LocalLayer(this));
  };

  Locals.prototype.pop = function() {
    this.index = this.layers[this.layers.length - 1].start_index;
    return this.layers.splice(this.layers.length - 1, 1);
  };

  Locals.prototype.register = function(name) {
    return this.layers[this.layers.length - 1].register(name);
  };

  Locals.prototype.allocate = function() {
    return this.layers[this.layers.length - 1].allocate();
  };

  Locals.prototype.get = function(name) {
    var i, j, ref, v;
    for (i = j = ref = this.layers.length - 1; j >= 0; i = j += -1) {
      v = this.layers[i].get(name);
      if (v != null) {
        return v;
      }
    }
    return null;
  };

  return Locals;

})();

LocalLayer = (function() {
  function LocalLayer(locals1) {
    this.locals = locals1;
    this.start_index = this.locals.index;
    this.registered = {};
  }

  LocalLayer.prototype.register = function(name) {
    return this.registered[name] = this.locals.index++;
  };

  LocalLayer.prototype.allocate = function() {
    return this.locals.index++;
  };

  LocalLayer.prototype.get = function(name) {
    if (this.registered[name] != null) {
      return this.registered[name];
    } else {
      return null;
    }
  };

  return LocalLayer;

})();
