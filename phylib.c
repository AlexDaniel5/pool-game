#include "phylib.h"

phylib_object *phylib_new_still_ball(unsigned char number, phylib_coord *pos) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_STILL_BALL;
    new_obj->obj.still_ball.number = number;
    new_obj->obj.still_ball.pos = *pos;
    return new_obj;
}

phylib_object *phylib_new_rolling_ball(unsigned char number, phylib_coord *pos, phylib_coord *vel, phylib_coord *acc) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_ROLLING_BALL;
    new_obj->obj.rolling_ball.number = number;
    new_obj->obj.rolling_ball.pos = *pos;
    new_obj->obj.rolling_ball.vel = *vel;
    new_obj->obj.rolling_ball.acc = *acc;
    return new_obj;
}

phylib_object *phylib_new_hole(phylib_coord *pos) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_HOLE;
    new_obj->obj.hole.pos = *pos;
    return new_obj;
}

phylib_object *phylib_new_hcushion(double y) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_HCUSHION;
    new_obj->obj.hcushion.y = y;
    return new_obj;
}

phylib_object *phylib_new_vcushion(double x) {
    phylib_object *new_obj = malloc(sizeof(phylib_object));
    new_obj->type = PHYLIB_VCUSHION;
    new_obj->obj.vcushion.x = x;
    return new_obj;
}

phylib_table *phylib_new_table(void) {
    phylib_table *new_table = malloc(sizeof(phylib_table));
    new_table->time = 0.0; // Set to 0.0 not phylib_sim_rate
    // Initalize objects to null to avoid valgrind complaints
    for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
        new_table->object[i] = NULL;
    }
    // Adding cushions
    new_table->object[0] = phylib_new_hcushion(0.0);
    new_table->object[1] = phylib_new_hcushion(PHYLIB_TABLE_LENGTH);
    new_table->object[2] = phylib_new_vcushion(0.0);
    new_table->object[3] = phylib_new_vcushion(PHYLIB_TABLE_WIDTH);
    // Setting positions of corner holes
    phylib_coord corner_hole_pos[4] = {
        {0.0, 0.0},
        {0.0, PHYLIB_TABLE_WIDTH},
        {0.0, PHYLIB_TABLE_LENGTH},
        {PHYLIB_TABLE_WIDTH, PHYLIB_TABLE_LENGTH}
    };
    // Creating the corner holes
    for (int i = 0; i < 3; ++i) {
        new_table->object[4 + i] = phylib_new_hole(&corner_hole_pos[i]);
    }
    // This corner hole has to be in the 10th array slot according to the example output
    new_table->object[9] = phylib_new_hole(&corner_hole_pos[3]);
    // Setting positions of midway holes
    phylib_coord mid_hole_pos[2] = {
        {PHYLIB_TABLE_LENGTH / 2.0, 0.0},
        {PHYLIB_TABLE_WIDTH, PHYLIB_TABLE_LENGTH / 2.0},
    };
    // Creating the middle holes
    for (int i = 0; i < 2; ++i) {
        new_table->object[7 + i] = phylib_new_hole(&mid_hole_pos[i]);
    }
    return new_table;
}

// Part 2:
void phylib_copy_object(phylib_object **dest, phylib_object **src) {
    if (*src == NULL) {
        *dest = NULL;
        return;
    }   
    *dest = malloc(sizeof(phylib_object));
    memcpy(*dest, *src, sizeof(phylib_object));
}

phylib_table *phylib_copy_table(phylib_table *table) {
    phylib_table *new_table = malloc(sizeof(phylib_table));
    new_table->time = table->time;
    // Copy all objects within the old table to the new table
    for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
        if (table->object[i] != NULL) {
            phylib_copy_object(&(new_table->object[i]), &(table->object[i]));
        }
        // So valgrind won't complain about uninitalized objects
        else {
            new_table->object[i] = NULL;
        }
    }
    return new_table;
}

void phylib_add_object(phylib_table *table, phylib_object *object) {
    for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
        // Find a NULL pointer, assign it to the address of object
        if (!table->object[i]) {
            table->object[i] = object;
            return;
        }
    }
}

void phylib_free_table(phylib_table *table) {
    if (table != NULL) {
        // Free all objects within the table
        for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
            if (table->object[i] != NULL) {
                free(table->object[i]);
                table->object[i] = NULL;
            }
        }
        free(table);
    }
}

// Calculates the distance between two coordinates
phylib_coord phylib_sub(phylib_coord c1, phylib_coord c2) {
    phylib_coord result;
    result.x = c1.x - c2.x;
    result.y = c1.y - c2.y;
    return result;
}

// Calculates the length of the coordinate c
double phylib_length(phylib_coord c) {
    // Exp function is inefficent, thus unused
    return sqrt(c.x * c.x + c.y * c.y);
}

// Calculates the dot product
double phylib_dot_product(phylib_coord a, phylib_coord b) {
    return a.x * b.x + a.y * b.y;
}


double phylib_distance(phylib_object *obj1, phylib_object *obj2) {
    // Error checking as advised
    if (obj1 == NULL || obj2 == NULL) {
        return -1.0;
    }
    if (obj1->type != PHYLIB_ROLLING_BALL) {
        return -1.0;
    }
    phylib_coord center = obj1->obj.rolling_ball.pos;

    switch (obj2->type) {
        // Between two balls
        case PHYLIB_ROLLING_BALL:
            return phylib_length(phylib_sub(center, obj2->obj.rolling_ball.pos)) - PHYLIB_BALL_DIAMETER;
        case PHYLIB_STILL_BALL:
            return phylib_length(phylib_sub(center, obj2->obj.still_ball.pos)) - PHYLIB_BALL_DIAMETER;
        // Between a ball and hole: captured once the ball is entirely over
        // the pocket mouth, not at first rim contact (so balls skimming the
        // pocket edge roll past instead of vanishing abruptly)
        case PHYLIB_HOLE:
            return phylib_length(phylib_sub(center, obj2->obj.hole.pos)) - (PHYLIB_HOLE_RADIUS - PHYLIB_BALL_RADIUS);
        // Between a ball and a horizontal cushion
        case PHYLIB_HCUSHION:
            return fabs(center.y - obj2->obj.hcushion.y) - PHYLIB_BALL_RADIUS; // fabs is the absolute value for doubles/floats
        // Between a ball and a vertical cushion
        case PHYLIB_VCUSHION:
            return fabs(center.x - obj2->obj.vcushion.x) - PHYLIB_BALL_RADIUS;
        default:
            return -1.0;
    }
}

// Part 3:
// Rolls the ball along a straight line under combined drag:
//   dv/dt = -(PHYLIB_DRAG + PHYLIB_DRAG_LINEAR * v)
// The constant term models rolling resistance, the linear term models
// speed-proportional losses so fast shots bleed speed early while soft
// shots stay gentle. Solved in closed form, so any step size gives the
// exact same trajectory (the C event loop and the Python animation
// interpolation both call this and always agree).
void phylib_roll(phylib_object *new, phylib_object *old, double time) {
    // Check if both objects are rolling balls
    if (new->type != PHYLIB_ROLLING_BALL || old->type != PHYLIB_ROLLING_BALL) {
        return;
    }
    double v0 = phylib_length(old->obj.rolling_ball.vel);
    if (v0 < 1e-12) {
        new->obj.rolling_ball.pos = old->obj.rolling_ball.pos;
        new->obj.rolling_ball.vel.x = 0.0;
        new->obj.rolling_ball.vel.y = 0.0;
        new->obj.rolling_ball.acc.x = 0.0;
        new->obj.rolling_ball.acc.y = 0.0;
        return;
    }
    double k = PHYLIB_DRAG_LINEAR;
    double c = PHYLIB_DRAG;
    // time at which the ball comes to rest
    double t_stop = log(1.0 + k * v0 / c) / k;
    double t = time < t_stop ? time : t_stop;
    double decay = exp(-k * t);
    double v = (v0 + c / k) * decay - c / k;
    if (v < 0.0) {
        v = 0.0;
    }
    double s = (v0 + c / k) * (1.0 - decay) / k - c * t / k;
    // drag is anti-parallel to velocity, so the direction never changes
    double ux = old->obj.rolling_ball.vel.x / v0;
    double uy = old->obj.rolling_ball.vel.y / v0;
    new->obj.rolling_ball.pos.x = old->obj.rolling_ball.pos.x + ux * s;
    new->obj.rolling_ball.pos.y = old->obj.rolling_ball.pos.y + uy * s;
    new->obj.rolling_ball.vel.x = ux * v;
    new->obj.rolling_ball.vel.y = uy * v;
    // acc is informational only (rolling uses vel directly)
    double a = v > 0.0 ? -(c + k * v) : 0.0;
    new->obj.rolling_ball.acc.x = ux * a;
    new->obj.rolling_ball.acc.y = uy * a;
}

unsigned char phylib_stopped(phylib_object *object) {
    // Calculate speed using the length of velocity vector
    double speed = phylib_length(object->obj.rolling_ball.vel);
    if (speed < PHYLIB_VEL_EPSILON) {
        object->type = PHYLIB_STILL_BALL;
        return 1;
    }
    return 0;
}

// Sets acc anti-parallel to vel (informational; phylib_roll derives drag
// from velocity directly)
static void phylib_set_drag_acc(phylib_object *ball) {
    double speed = phylib_length(ball->obj.rolling_ball.vel);
    if (speed > PHYLIB_VEL_EPSILON) {
        double a = -(PHYLIB_DRAG + PHYLIB_DRAG_LINEAR * speed) / speed;
        ball->obj.rolling_ball.acc.x = ball->obj.rolling_ball.vel.x * a;
        ball->obj.rolling_ball.acc.y = ball->obj.rolling_ball.vel.y * a;
    } else {
        ball->obj.rolling_ball.acc.x = 0.0;
        ball->obj.rolling_ball.acc.y = 0.0;
    }
}

void phylib_bounce(phylib_object **a, phylib_object **b) {
    // Bounce off a horizontal cushion: reflect only if the ball is moving
    // toward the rail (a ball still overlapping while separating must not
    // re-bounce, or it sticks and jitters against the cushion)
    if ((*b)->type == PHYLIB_HCUSHION) {
        double rel = (*a)->obj.rolling_ball.pos.y - (*b)->obj.hcushion.y;
        double vy = (*a)->obj.rolling_ball.vel.y;
        if ((rel > 0.0 && vy < 0.0) || (rel < 0.0 && vy > 0.0)) {
            (*a)->obj.rolling_ball.vel.y = -vy * PHYLIB_CUSHION_RESTITUTION;
            (*a)->obj.rolling_ball.vel.x *= PHYLIB_CUSHION_TANGENT;
            phylib_set_drag_acc(*a);
        }
        return;
    }
    // Bounce off a vertical cushion
    else if ((*b)->type == PHYLIB_VCUSHION) {
        double rel = (*a)->obj.rolling_ball.pos.x - (*b)->obj.vcushion.x;
        double vx = (*a)->obj.rolling_ball.vel.x;
        if ((rel > 0.0 && vx < 0.0) || (rel < 0.0 && vx > 0.0)) {
            (*a)->obj.rolling_ball.vel.x = -vx * PHYLIB_CUSHION_RESTITUTION;
            (*a)->obj.rolling_ball.vel.y *= PHYLIB_CUSHION_TANGENT;
            phylib_set_drag_acc(*a);
        }
        return;
    }
    // Get rid of the rolling ball because it sank into a hole
    else if ((*b)->type == PHYLIB_HOLE) {
        free(*a);
        *a = NULL;
        return;
    }

    // Ball-ball collision (b may be still or rolling)
    phylib_coord b_pos = (*b)->type == PHYLIB_STILL_BALL ?
        (*b)->obj.still_ball.pos : (*b)->obj.rolling_ball.pos;
    phylib_coord b_vel = {0.0, 0.0};
    if ((*b)->type == PHYLIB_ROLLING_BALL) {
        b_vel = (*b)->obj.rolling_ball.vel;
    }
    phylib_coord r_ab = phylib_sub((*a)->obj.rolling_ball.pos, b_pos);
    double dist = phylib_length(r_ab);
    if (dist < 1e-12) {
        return;
    }
    // Normal vector from b to a
    phylib_coord n = {r_ab.x / dist, r_ab.y / dist};
    phylib_coord v_rel = phylib_sub((*a)->obj.rolling_ball.vel, b_vel);
    double v_rel_n = phylib_dot_product(v_rel, n);
    // Only collide if the balls are approaching; overlapping balls that are
    // already separating get no impulse (prevents sticking and energy gain)
    if (v_rel_n >= 0.0) {
        return;
    }
    // The rolling ball hits a still ball: set it rolling
    if ((*b)->type == PHYLIB_STILL_BALL) {
        (*b)->type = PHYLIB_ROLLING_BALL;
        (*b)->obj.rolling_ball.vel.x = 0.0;
        (*b)->obj.rolling_ball.vel.y = 0.0;
        (*b)->obj.rolling_ball.acc.x = 0.0;
        (*b)->obj.rolling_ball.acc.y = 0.0;
    }
    // Equal-mass impulse with restitution along the contact normal
    double j = 0.5 * (1.0 + PHYLIB_BALL_RESTITUTION) * v_rel_n;
    (*a)->obj.rolling_ball.vel.x -= j * n.x;
    (*a)->obj.rolling_ball.vel.y -= j * n.y;
    (*b)->obj.rolling_ball.vel.x += j * n.x;
    (*b)->obj.rolling_ball.vel.y += j * n.y;
    // Separate any overlap so balls never render intersecting or re-collide
    double overlap = PHYLIB_BALL_DIAMETER - dist;
    if (overlap > 0.0) {
        (*a)->obj.rolling_ball.pos.x += n.x * overlap * 0.5;
        (*a)->obj.rolling_ball.pos.y += n.y * overlap * 0.5;
        (*b)->obj.rolling_ball.pos.x -= n.x * overlap * 0.5;
        (*b)->obj.rolling_ball.pos.y -= n.y * overlap * 0.5;
    }
    phylib_set_drag_acc(*a);
    phylib_set_drag_acc(*b);
}

// Returns the number of rolling balls on the table
unsigned char phylib_rolling(phylib_table *t) {
    unsigned char rolling_count = 0;
    for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
        // Might want to check for NULL; t->object[i]
        if (t->object[i] != NULL && t->object[i]->type == PHYLIB_ROLLING_BALL) {
            rolling_count++;
        }
    }
    return rolling_count;
}

phylib_table *phylib_segment(phylib_table *table) {
    // Check if there are any rolling balls on the table
    if (phylib_rolling(table) == 0) {
        return NULL;
    }
    phylib_table *copied_table = phylib_copy_table(table);

    while (copied_table->time < PHYLIB_MAX_TIME) {

        // Roll balls in this loop
        for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
            if (copied_table->object[i] && copied_table->object[i]->type == PHYLIB_ROLLING_BALL) {
                phylib_object *new_state = NULL;
                phylib_copy_object(&new_state, &copied_table->object[i]);
                phylib_roll(new_state, copied_table->object[i], PHYLIB_SIM_RATE);
                free(copied_table->object[i]);
                copied_table->object[i] = new_state;
            }
        }

        // Check for bounces and stops in this loop
        for (int i = 0; i < PHYLIB_MAX_OBJECTS; i++) {
            if (copied_table->object[i] && copied_table->object[i]->type == PHYLIB_ROLLING_BALL) {
                if (phylib_stopped(copied_table->object[i])) {
                    return copied_table;
                }
                for (int j = 0; j < PHYLIB_MAX_OBJECTS; j++) {
                    if (i != j && copied_table->object[j]) {
                        double distance = phylib_distance(copied_table->object[i], copied_table->object[j]);
                        if (distance < 0.0) {
                            // Check if a collision occurred
                            phylib_bounce(&copied_table->object[i], &copied_table->object[j]);
                            return copied_table;
                        }
                    }
                }
            }
        }
        copied_table->time += PHYLIB_SIM_RATE;
    }
    // Maximum time reached without stopping or collisions
    return copied_table;
}

char *phylib_object_string( phylib_object *object ) {
    static char string[80];
    if (object == NULL) {
        snprintf( string, 80, "NULL;" );
        return string;
    }
    switch (object->type) {
        case PHYLIB_STILL_BALL:
            snprintf( string, 80,
                "STILL_BALL (%d,%6.1lf,%6.1lf)",
                object->obj.still_ball.number,
                object->obj.still_ball.pos.x,
                object->obj.still_ball.pos.y );
            break;
        case PHYLIB_ROLLING_BALL:
            snprintf( string, 80,
                "ROLLING_BALL (%d,%6.1lf,%6.1lf,%6.1lf,%6.1lf,%6.1lf,%6.1lf)",
                object->obj.rolling_ball.number,
                object->obj.rolling_ball.pos.x,
                object->obj.rolling_ball.pos.y,
                object->obj.rolling_ball.vel.x,
                object->obj.rolling_ball.vel.y,
                object->obj.rolling_ball.acc.x,
                object->obj.rolling_ball.acc.y );
            break;
        case PHYLIB_HOLE:
            snprintf( string, 80,
                "HOLE (%6.1lf,%6.1lf)",
                object->obj.hole.pos.x,
                object->obj.hole.pos.y );
            break;
        case PHYLIB_HCUSHION:
            snprintf( string, 80,
                "HCUSHION (%6.1lf)",
                object->obj.hcushion.y );
            break;
        case PHYLIB_VCUSHION:
            snprintf( string, 80,
                "VCUSHION (%6.1lf)",
                object->obj.vcushion.x );
            break;
    }
    return string;
}
